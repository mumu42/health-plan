// 导入必要的依赖包
const axios = require('axios');          // 用于发送HTTP请求
const cheerio = require('cheerio');      // 用于解析HTML，类似jQuery
const puppeteer = require('puppeteer-core');  // 用于模拟浏览器操作
const ExcelJS = require('exceljs');      // 用于生成Excel文件
const randomUseragent = require('random-useragent');  // 用于生成随机User-Agent
const winston = require('winston');      // 用于日志记录
const path = require('path');            // 用于处理文件路径
const fs = require('fs');                // 用于文件系统操作
const os = require('os');                // 用于操作系统相关操作

// 可能的Chrome安装路径
const CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
];

// 查找Chrome可执行文件
function findChromePath() {
    for (const chromePath of CHROME_PATHS) {
        if (fs.existsSync(chromePath)) {
            return chromePath;
        }
    }
    throw new Error('Chrome not found. Please install Google Chrome browser.');
}

// 配置日志记录器
const logger = winston.createLogger({
    level: 'info',  // 设置日志级别
    format: winston.format.combine(
        winston.format.timestamp(),  // 添加时间戳
        winston.format.json()        // 使用JSON格式
    ),
    transports: [
        // 错误日志文件
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        // 完整日志文件
        new winston.transports.File({ filename: 'combined.log' }),
        // 控制台输出
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// 添加延迟函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 添加浏览器清理函数
async function cleanupBrowser(browser) {
    if (!browser) return;
    try {
        const pages = await browser.pages();
        await Promise.all(pages.map(page => page.close()));
        await browser.close();
        await delay(1000); // 等待1秒确保资源释放
    } catch (error) {
        logger.error(`浏览器清理错误: ${error.message}`);
    }
}

/**
 * 基础爬虫类
 * 提供通用的爬虫功能
 */
class BaseCrawler {
    constructor() {
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Connection': 'keep-alive'
        };
    }

    /**
     * 获取随机User-Agent
     * @returns {string} 随机User-Agent
     */
    getRandomUserAgent() {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.67'
        ];
        return userAgents[Math.floor(Math.random() * userAgents.length)];
    }

    /**
     * 获取页面内容
     * @param {string} url - 要爬取的URL
     * @returns {Promise<string|null>} 页面HTML内容或null（如果失败）
     */
    async getPage(url) {
        try {
            const response = await axios.get(url, { 
                headers: this.headers, 
                timeout: 10000,  // 10秒超时
                validateStatus: function (status) {
                    return status >= 200 && status < 500; // 接受所有非500错误的状态码
                }
            });
            return response.data;
        } catch (error) {
            logger.error(`Error fetching ${url}: ${error.message}`);
            return null;
        }
    }

    /**
     * 清理浏览器临时文件
     * @param {Browser} browser 浏览器实例
     */
    async cleanupBrowser(browser) {
        try {
            const pages = await browser.pages();
            await Promise.all(pages.map(page => page.close()));
            await browser.close();
        } catch (error) {
            logger.error(`清理浏览器错误: ${error.message}`);
        }
    }
}

/**
 * 微博热搜爬虫类
 */
class WeiboCrawler extends BaseCrawler {
    constructor() {
        super();
        this.url = 'https://s.weibo.com/top/summary';  // 微博热搜榜URL
    }

    /**
     * 获取微博热搜话题
     * @returns {Promise<string[]>} 热搜话题列表
     */
    async getHotTopics() {
        let browser = null;
        try {
            const chromePath = findChromePath();
            browser = await puppeteer.launch({
                headless: true,
                executablePath: chromePath,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
                userDataDir: path.join(os.tmpdir(), `puppeteer_${Date.now()}`)
            });
            const page = await browser.newPage();
            await page.setUserAgent(randomUseragent.getRandom());
            
            logger.info('正在访问微博热搜榜页面...');
            await page.goto(this.url, { waitUntil: 'networkidle0', timeout: 30000 });
            
            // 等待热搜列表加载完成
            await page.waitForSelector('.td-02', { timeout: 10000 }).catch(() => {
                logger.error('未找到微博热搜列表元素');
            });
            
            // 等待一段时间确保动态内容加载完成
            await page.waitForTimeout(2000);
            
            // 获取元素数量
            const elementCount = await page.evaluate(() => {
                return document.querySelectorAll('.td-02').length;
            });
            logger.info(`找到 ${elementCount} 个热搜元素`);
            
            const topics = await page.evaluate(() => {
                const elements = document.querySelectorAll('.td-02');
                return Array.from(elements, el => el.textContent.trim())
                    .filter(topic => topic && !topic.includes('广告'))
                    .slice(0, 50);
            });

            logger.info(`成功获取微博热搜话题数量: ${topics.length}`);
            return topics;
        } catch (error) {
            logger.error(`获取微博热搜话题错误: ${error.message}`);
            return [];
        } finally {
            if (browser) {
                await cleanupBrowser(browser);
            }
        }
    }
}

/**
 * 知乎热搜爬虫类
 */
class ZhihuCrawler extends BaseCrawler {
    constructor() {
        super();
        this.url = 'https://www.zhihu.com/hot';  // 知乎热榜URL
        this.loginUrl = 'https://www.zhihu.com/signin';  // 知乎登录URL
    }

    /**
     * 登录知乎
     * @param {Page} page - Puppeteer页面对象
     * @param {string} username - 用户名
     * @param {string} password - 密码
     */
    async login(page, username, password) {
        try {
            logger.info('正在访问知乎登录页面...');
            await page.goto(this.loginUrl, { waitUntil: 'networkidle0' });
            
            // 等待登录表单加载
            await page.waitForSelector('.SignFlow-accountInput', { timeout: 10000 });
            
            // 输入用户名和密码
            await page.type('.SignFlow-accountInput', username);
            await page.type('.SignFlow-password', password);
            
            // 点击登录按钮
            await page.click('.SignFlow-submitButton');
            
            // 等待登录完成
            await page.waitForNavigation({ waitUntil: 'networkidle0' });
            
            logger.info('知乎登录成功');
        } catch (error) {
            logger.error(`知乎登录失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 获取知乎热搜话题
     * @returns {Promise<string[]>} 热搜话题列表
     */
    async getHotTopics() {
        let browser = null;
        try {
            const chromePath = findChromePath();
            browser = await puppeteer.launch({
                headless: true,
                executablePath: chromePath,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
                userDataDir: path.join(os.tmpdir(), `puppeteer_${Date.now()}`)
            });
            const page = await browser.newPage();
            await page.setUserAgent(randomUseragent.getRandom());
            
            // 设置知乎登录信息
            const username = process.env.ZHIHU_USERNAME;
            const password = process.env.ZHIHU_PASSWORD;
            
            if (username && password) {
                await this.login(page, username, password);
            } else {
                logger.warn('未设置知乎登录信息，可能无法获取完整的热搜数据');
            }
            
            logger.info('正在访问知乎热榜页面...');
            await page.goto(this.url, { waitUntil: 'networkidle0', timeout: 30000 });
            
            // 等待页面加载完成，知乎现在使用新的选择器
            await page.waitForSelector('.HotList-item', { timeout: 10000 }).catch(() => {
                logger.error('未找到知乎热搜列表元素');
            });
            
            // 等待一段时间确保动态内容加载完成
            await page.waitForTimeout(2000);
            
            // 获取元素数量
            const elementCount = await page.evaluate(() => {
                return document.querySelectorAll('.HotList-item').length;
            });
            logger.info(`找到 ${elementCount} 个知乎热搜元素`);
            
            const topics = await page.evaluate(() => {
                const elements = document.querySelectorAll('.HotList-item');
                return Array.from(elements, el => {
                    const title = el.querySelector('.HotItem-title');
                    return title ? title.textContent.trim() : '';
                }).filter(topic => topic).slice(0, 50);
            });

            logger.info(`成功获取知乎热搜话题数量: ${topics.length}`);
            return topics;
        } catch (error) {
            logger.error(`获取知乎热搜话题错误: ${error.message}`);
            return [];
        } finally {
            if (browser) {
                await cleanupBrowser(browser);
            }
        }
    }
}

/**
 * 头条热搜爬虫类
 */
class ToutiaoCrawler extends BaseCrawler {
    constructor() {
        super();
        this.url = 'https://www.toutiao.com/hot-event/hot-board/';
    }

    /**
     * 获取头条热搜话题
     * @returns {Promise<string[]>} 热搜话题列表
     */
    async getHotTopics() {
        let browser;
        try {
            logger.info('正在启动浏览器访问头条热榜页面...');
            browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ],
                executablePath: process.env.CHROME_PATH || undefined
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent(this.getRandomUserAgent());

            // 设置请求拦截
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            logger.info('正在访问头条热榜页面...');
            await page.goto(this.url, { waitUntil: 'networkidle0', timeout: 30000 });

            // 等待页面加载完成
            await page.waitForSelector('.hot-board-list', { timeout: 10000 })
                .catch(() => logger.warn('未找到热榜列表，尝试其他选择器...'));

            // 等待一段时间确保动态内容加载完成
            await page.waitForTimeout(2000);

            // 尝试多个可能的选择器
            const selectors = [
                '.hot-board-list .item',
                '.hot-board-list .title',
                '.hot-board-list-item',
                '.hot-board-list-item-title',
                '.hot-board-item',
                '.hot-board-item-title'
            ];

            let topics = [];
            for (const selector of selectors) {
                const elements = await page.$$(selector);
                if (elements.length > 0) {
                    logger.info(`使用选择器 ${selector} 找到 ${elements.length} 个元素`);
                    topics = await page.evaluate((sel) => {
                        return Array.from(document.querySelectorAll(sel))
                            .map(el => el.textContent.trim())
                            .filter(text => text);
                    }, selector);
                    if (topics.length > 0) break;
                }
            }

            if (topics.length === 0) {
                // 如果所有选择器都失败，尝试获取页面内容进行分析
                const content = await page.content();
                logger.info('页面内容预览:', content.substring(0, 1000));
                throw new Error('未找到热搜话题');
            }

            logger.info(`成功获取头条热搜话题数量: ${topics.length}`);
            return topics.slice(0, 50);
        } catch (error) {
            logger.error(`获取头条热搜话题错误: ${error.message}`);
            return [];
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (error) {
                    logger.error(`关闭浏览器错误: ${error.message}`);
                }
            }
        }
    }
}

/**
 * 抖音热搜爬虫类
 */
class DouyinCrawler extends BaseCrawler {
    constructor() {
        super();
        this.url = 'https://www.douyin.com/hot';
    }

    /**
     * 获取抖音热搜话题
     * @returns {Promise<string[]>} 热搜话题列表
     */
    async getHotTopics() {
        let browser;
        try {
            logger.info('正在启动浏览器访问抖音热榜页面...');
            
            // 使用正确的Chrome路径
            const chromePath = 'C:\\Users\\huang.guizhen\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
            logger.info(`使用Chrome路径: ${chromePath}`);

            const launchOptions = {
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-extensions'
                ],
                executablePath: chromePath,
                ignoreDefaultArgs: ['--enable-automation'],
                timeout: 60000
            };

            browser = await puppeteer.launch(launchOptions);

            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent(this.getRandomUserAgent());

            // 设置请求拦截
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            logger.info('正在访问抖音热榜页面...');
            await page.goto(this.url, { 
                waitUntil: 'networkidle0', 
                timeout: 60000 
            });

            // 等待页面加载完成
            await page.waitForTimeout(10000); // 增加等待时间

            // 尝试多个可能的选择器
            const selectors = [
                '.hot-list',
                '.hot-item',
                '.hot-title',
                '.trending-list',
                '.trending-item',
                '.trending-title',
                '.search-list',
                '.search-item',
                '.search-title',
                '.hot-search-list',
                '.hot-search-item',
                '.hot-search-title'
            ];

            let topics = [];
            for (const selector of selectors) {
                try {
                    const elements = await page.$$(selector);
                    if (elements.length > 0) {
                        logger.info(`使用选择器 ${selector} 找到 ${elements.length} 个元素`);
                        topics = await page.evaluate((sel) => {
                            return Array.from(document.querySelectorAll(sel))
                                .map(el => el.textContent.trim())
                                .filter(text => text);
                        }, selector);
                        if (topics.length > 0) {
                            logger.info(`成功使用选择器 ${selector} 获取到 ${topics.length} 个话题`);
                            break;
                        }
                    }
                } catch (error) {
                    logger.warn(`选择器 ${selector} 执行失败: ${error.message}`);
                }
            }

            if (topics.length === 0) {
                // 如果所有选择器都失败，获取页面内容进行分析
                const content = await page.content();
                logger.info('页面内容预览:', content.substring(0, 1000));
                
                // 尝试获取所有文本内容
                const allText = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('*'))
                        .map(el => el.textContent.trim())
                        .filter(text => text.length > 0);
                });
                logger.info('页面所有文本内容:', allText.slice(0, 20));

                throw new Error('未找到抖音热搜列表元素');
            }

            logger.info(`成功获取抖音热搜话题数量: ${topics.length}`);
            return topics.slice(0, 50);
        } catch (error) {
            logger.error(`获取抖音热搜话题错误: ${error.message}`);
            return [];
        } finally {
            if (browser) {
                await this.cleanupBrowser(browser);
            }
        }
    }
}

/**
 * 快手热搜爬虫类
 */
class KuaishouCrawler extends BaseCrawler {
    constructor() {
        super();
        this.url = 'https://www.kuaishou.com/hot-search';
    }

    /**
     * 获取快手热搜话题
     * @returns {Promise<string[]>} 热搜话题列表
     */
    async getHotTopics() {
        let browser;
        try {
            logger.info('正在启动浏览器访问快手热榜页面...');
            
            // 使用正确的Chrome路径
            const chromePath = 'C:\\Users\\huang.guizhen\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
            logger.info(`使用Chrome路径: ${chromePath}`);

            const launchOptions = {
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-extensions'
                ],
                executablePath: chromePath,
                ignoreDefaultArgs: ['--enable-automation'],
                timeout: 60000
            };

            browser = await puppeteer.launch(launchOptions);

            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent(this.getRandomUserAgent());

            // 设置请求拦截
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            logger.info('正在访问快手热榜页面...');
            await page.goto(this.url, { 
                waitUntil: 'networkidle0', 
                timeout: 60000 
            });

            // 等待页面加载完成
            await page.waitForTimeout(10000); // 增加等待时间

            // 尝试多个可能的选择器
            const selectors = [
                '.hot-topic-list',
                '.hot-topic-item',
                '.topic-title',
                '.hot-search-list',
                '.hot-search-item',
                '.search-item-title',
                '.trending-list',
                '.trending-item',
                '.trending-title',
                '.hot-list',
                '.hot-item',
                '.hot-title'
            ];

            let topics = [];
            for (const selector of selectors) {
                try {
                    const elements = await page.$$(selector);
                    if (elements.length > 0) {
                        logger.info(`使用选择器 ${selector} 找到 ${elements.length} 个元素`);
                        topics = await page.evaluate((sel) => {
                            return Array.from(document.querySelectorAll(sel))
                                .map(el => el.textContent.trim())
                                .filter(text => text);
                        }, selector);
                        if (topics.length > 0) {
                            logger.info(`成功使用选择器 ${selector} 获取到 ${topics.length} 个话题`);
                            break;
                        }
                    }
                } catch (error) {
                    logger.warn(`选择器 ${selector} 执行失败: ${error.message}`);
                }
            }

            if (topics.length === 0) {
                // 如果所有选择器都失败，获取页面内容进行分析
                const content = await page.content();
                logger.info('页面内容预览:', content.substring(0, 1000));
                
                // 尝试获取所有文本内容
                const allText = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('*'))
                        .map(el => el.textContent.trim())
                        .filter(text => text.length > 0);
                });
                logger.info('页面所有文本内容:', allText.slice(0, 20));

                throw new Error('未找到快手热搜列表元素');
            }

            logger.info(`成功获取快手热搜话题数量: ${topics.length}`);
            return topics.slice(0, 50);
        } catch (error) {
            logger.error(`获取快手热搜话题错误: ${error.message}`);
            return [];
        } finally {
            if (browser) {
                await this.cleanupBrowser(browser);
            }
        }
    }
}

/**
 * 将数据保存为Excel文件
 * @param {Array} data - 要保存的数据
 * @param {string} filename - 文件名
 */
async function saveToExcel(data, filename) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Hot Topics');

    // 设置列
    worksheet.columns = [
        { header: '平台', key: 'platform', width: 15 },
        { header: '排名', key: 'rank', width: 10 },
        { header: '话题', key: 'topic', width: 50 }
    ];

    // 添加数据行
    data.forEach(item => {
        worksheet.addRow(item);
    });

    // 保存文件
    await workbook.xlsx.writeFile(filename);
    logger.info(`Data saved to ${filename}`);
}

/**
 * 主函数
 * 协调所有爬虫工作并保存结果
 */
async function main() {
    try {
        // 初始化爬虫
        const crawlers = [
            new WeiboCrawler(),    // 重新启用微博爬虫
            // new ToutiaoCrawler(),
            // new DouyinCrawler(),
            // new KuaishouCrawler()
        ];

        // 获取所有平台的热搜话题
        const results = await Promise.all(
            crawlers.map(async crawler => {
                try {
                    const topics = await crawler.getHotTopics();
                    return {
                        platform: crawler.constructor.name.replace('Crawler', ''),
                        topics: topics || []
                    };
                } catch (error) {
                    logger.error(`${crawler.constructor.name} 获取热搜话题失败: ${error.message}`);
                    return {
                        platform: crawler.constructor.name.replace('Crawler', ''),
                        topics: []
                    };
                }
            })
        );

        // 准备Excel数据
        const excelData = [];
        results.forEach(result => {
            if (result.topics && Array.isArray(result.topics)) {
                result.topics.forEach((topic, index) => {
                    excelData.push({
                        '平台': result.platform,
                        '排名': index + 1,
                        '话题': topic
                    });
                });
            }
        });

        // 生成Excel文件
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('热搜话题');

        // 设置表头
        worksheet.columns = [
            { header: '平台', key: '平台', width: 15 },
            { header: '排名', key: '排名', width: 10 },
            { header: '话题', key: '话题', width: 50 }
        ];

        // 添加数据
        worksheet.addRows(excelData);

        // 设置样式
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // 保存文件
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `热搜话题_${timestamp}.xlsx`;
        await workbook.xlsx.writeFile(filename);
        logger.info(`Excel文件已生成: ${filename}`);

    } catch (error) {
        logger.error(`Main process error: ${error.message}`);
        process.exit(1);
    }
}

// 运行爬虫程序
main().catch(error => {
    logger.error(`Main process error: ${error.message}`);
    process.exit(1);
}); 