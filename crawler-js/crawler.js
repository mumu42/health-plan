const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');
const randomUseragent = require('random-useragent');
const winston = require('winston');
const path = require('path');

// 配置日志
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

class BaseCrawler {
    constructor() {
        this.headers = {
            'User-Agent': randomUseragent.getRandom()
        };
    }

    async getPage(url) {
        try {
            const response = await axios.get(url, { headers: this.headers, timeout: 10000 });
            return response.data;
        } catch (error) {
            logger.error(`Error fetching ${url}: ${error.message}`);
            return null;
        }
    }
}

class WeiboCrawler extends BaseCrawler {
    constructor() {
        super();
        this.url = 'https://s.weibo.com/top/summary';
    }

    async getHotTopics() {
        const html = await this.getPage(this.url);
        if (!html) return [];

        try {
            const $ = cheerio.load(html);
            const topics = [];
            $('.td-02').each((index, element) => {
                if (index < 50) {
                    const topic = $(element).text().trim();
                    if (topic) topics.push(topic);
                }
            });
            return topics;
        } catch (error) {
            logger.error(`Error parsing Weibo hot topics: ${error.message}`);
            return [];
        }
    }
}

class ZhihuCrawler extends BaseCrawler {
    constructor() {
        super();
        this.url = 'https://www.zhihu.com/hot';
    }

    async getHotTopics() {
        try {
            const browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setUserAgent(randomUseragent.getRandom());
            await page.goto(this.url, { waitUntil: 'networkidle0' });
            
            const topics = await page.evaluate(() => {
                const elements = document.querySelectorAll('.HotItem-title');
                return Array.from(elements, el => el.textContent.trim()).slice(0, 50);
            });

            await browser.close();
            return topics;
        } catch (error) {
            logger.error(`Error fetching Zhihu hot topics: ${error.message}`);
            return [];
        }
    }
}

class ToutiaoCrawler extends BaseCrawler {
    constructor() {
        super();
        this.url = 'https://www.toutiao.com/hot-event/hot-board/';
    }

    async getHotTopics() {
        const html = await this.getPage(this.url);
        if (!html) return [];

        try {
            const data = JSON.parse(html);
            return data.data.map(item => item.Title).slice(0, 50);
        } catch (error) {
            logger.error(`Error parsing Toutiao hot topics: ${error.message}`);
            return [];
        }
    }
}

class DouyinCrawler extends BaseCrawler {
    constructor() {
        super();
        this.url = 'https://www.douyin.com/hot';
    }

    async getHotTopics() {
        try {
            const browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setUserAgent(randomUseragent.getRandom());
            await page.goto(this.url, { waitUntil: 'networkidle0' });
            
            const topics = await page.evaluate(() => {
                const elements = document.querySelectorAll('.hot-search-item');
                return Array.from(elements, el => el.textContent.trim()).slice(0, 50);
            });

            await browser.close();
            return topics;
        } catch (error) {
            logger.error(`Error fetching Douyin hot topics: ${error.message}`);
            return [];
        }
    }
}

class KuaishouCrawler extends BaseCrawler {
    constructor() {
        super();
        this.url = 'https://www.kuaishou.com/hot';
    }

    async getHotTopics() {
        try {
            const browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setUserAgent(randomUseragent.getRandom());
            await page.goto(this.url, { waitUntil: 'networkidle0' });
            
            const topics = await page.evaluate(() => {
                const elements = document.querySelectorAll('.hot-topic-item');
                return Array.from(elements, el => el.textContent.trim()).slice(0, 50);
            });

            await browser.close();
            return topics;
        } catch (error) {
            logger.error(`Error fetching Kuaishou hot topics: ${error.message}`);
            return [];
        }
    }
}

async function saveToExcel(data, filename) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Hot Topics');

    worksheet.columns = [
        { header: '平台', key: 'platform', width: 15 },
        { header: '排名', key: 'rank', width: 10 },
        { header: '话题', key: 'topic', width: 50 }
    ];

    data.forEach(item => {
        worksheet.addRow(item);
    });

    await workbook.xlsx.writeFile(filename);
    logger.info(`Data saved to ${filename}`);
}

async function main() {
    const crawlers = {
        '微博': new WeiboCrawler(),
        '知乎': new ZhihuCrawler(),
        '头条': new ToutiaoCrawler(),
        '抖音': new DouyinCrawler(),
        '快手': new KuaishouCrawler()
    };

    const results = {};
    for (const [platform, crawler] of Object.entries(crawlers)) {
        logger.info(`Fetching hot topics from ${platform}...`);
        const topics = await crawler.getHotTopics();
        results[platform] = topics;
    }

    // 准备Excel数据
    const data = [];
    for (const [platform, topics] of Object.entries(results)) {
        topics.forEach((topic, index) => {
            data.push({
                platform,
                rank: index + 1,
                topic
            });
        });
    }

    // 保存结果
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const filename = `hot_topics_${timestamp}.xlsx`;
    await saveToExcel(data, filename);
}

// 运行爬虫
main().catch(error => {
    logger.error(`Main process error: ${error.message}`);
    process.exit(1);
}); 