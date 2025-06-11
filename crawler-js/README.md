# 社交媒体热搜话题爬虫

这是一个基于Node.js的爬虫项目，用于抓取各大社交媒体平台的热搜话题。支持以下平台：
- 微博
- 知乎
- 今日头条
- 抖音
- 快手

## 环境要求

- Node.js 14.0+
- Chrome浏览器（用于Puppeteer爬取）

## 安装依赖

```bash
npm install
```

## 使用方法

1. 确保已安装所有依赖
2. 确保已安装Chrome浏览器
3. 运行爬虫程序：

```bash
npm start
```

程序会自动抓取各个平台的热搜话题，并将结果保存为Excel文件。文件名格式为：`hot_topics_YYYYMMDDTHHMMSS.xlsx`

## 项目结构

- `crawler.js` - 主爬虫程序
- `package.json` - 项目依赖配置
- `error.log` - 错误日志
- `combined.log` - 完整日志

## 注意事项

1. 部分平台（如知乎、抖音、快手）需要登录才能访问热搜榜，当前版本使用Puppeteer模拟浏览器访问，可能需要根据实际情况调整选择器
2. 建议适当调整爬取间隔，避免被封IP
3. 使用前请确保遵守各平台的使用条款和robots.txt规则

## 输出格式

输出的Excel文件包含以下列：
- 平台：热搜话题来源平台
- 排名：话题排名
- 话题：热搜话题内容

## 错误处理

程序会自动记录错误日志到 `error.log` 文件，同时也会在控制台输出错误信息。如果遇到问题，请查看日志文件了解详细信息。

# 微博热搜爬虫

## 概述
这是一个基于Puppeteer的微博热搜爬虫，用于自动获取微博热搜榜的热门话题。该爬虫采用无头浏览器技术，模拟真实用户行为，能够有效绕过基本的反爬虫机制。

## 工作机制

### 1. 基础设置
- 继承自`BaseCrawler`基类
- 使用微博热搜页面URL: `https://s.weibo.com/top/summary`
- 采用随机User-Agent模拟真实浏览器访问

### 2. 浏览器配置
```javascript
const launchOptions = {
    headless: 'new',  // 使用新版无头模式
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
    ],
    executablePath: chromePath,  // 使用本地Chrome浏览器
    ignoreDefaultArgs: ['--enable-automation']  // 隐藏自动化特征
}
```

### 3. 页面访问流程
1. 启动无头浏览器
2. 创建新页面并设置视口大小(1920x1080)
3. 设置随机User-Agent
4. 配置请求拦截，优化性能：
   - 拦截图片、样式表、字体等静态资源
   - 允许必要的JavaScript和XHR请求

### 4. 数据获取机制
1. 访问微博热搜页面
2. 等待页面加载完成（使用networkidle0策略）
3. 使用多个备选选择器尝试获取热搜数据：
   ```javascript
   const selectors = [
       '.td-02 a',           // 主要选择器
       '.td-02',            // 备选选择器1
       '.data a',           // 备选选择器2
       '.data',             // 备选选择器3
       '.td-02 p',          // 备选选择器4
       '.td-02 span'        // 备选选择器5
   ];
   ```

### 5. 数据处理
1. 提取热搜话题文本
2. 过滤空值和无效数据
3. 限制返回数量为50条
4. 记录日志信息

### 6. 错误处理
- 完整的try-catch错误处理机制
- 详细的日志记录
- 浏览器资源自动清理
- 超时处理（60秒）

### 7. 资源管理
- 使用`cleanupBrowser`方法确保浏览器实例正确关闭
- 自动清理临时文件和缓存
- 内存使用优化

## 使用说明

### 环境要求
- Node.js 14+
- Chrome浏览器
- 必要的npm包：
  - puppeteer
  - winston (日志)
  - random-useragent

### 配置说明
1. 确保Chrome浏览器已安装
2. 设置正确的Chrome路径
3. 配置日志级别和输出

### 运行方式
```javascript
const crawler = new WeiboCrawler();
const topics = await crawler.getHotTopics();
```

## 注意事项
1. 需要稳定的网络连接
2. 建议使用代理IP轮换
3. 注意访问频率限制
4. 定期更新选择器以适应页面变化

## 日志记录
- 记录爬虫启动和关闭
- 记录页面访问状态
- 记录数据获取结果
- 记录错误和异常情况

## 性能优化
1. 使用请求拦截减少资源加载
2. 优化选择器匹配策略
3. 实现浏览器实例复用
4. 内存使用优化

## 维护建议
1. 定期检查选择器有效性
2. 监控页面结构变化
3. 更新User-Agent列表
4. 优化错误处理机制 