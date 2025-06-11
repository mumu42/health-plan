import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from fake_useragent import UserAgent
import pandas as pd
import time
import json
from datetime import datetime
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class BaseCrawler:
    def __init__(self):
        self.ua = UserAgent()
        self.headers = {
            'User-Agent': self.ua.random
        }
    
    def get_page(self, url):
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            return response.text
        except Exception as e:
            logger.error(f"Error fetching {url}: {str(e)}")
            return None

class WeiboCrawler(BaseCrawler):
    def __init__(self):
        super().__init__()
        self.url = "https://s.weibo.com/top/summary"
    
    def get_hot_topics(self):
        html = self.get_page(self.url)
        if not html:
            return []
        
        soup = BeautifulSoup(html, 'html.parser')
        topics = []
        
        try:
            items = soup.select('.td-02')
            for item in items[:50]:  # 获取前50个热搜
                topic = item.get_text(strip=True)
                if topic:
                    topics.append(topic)
        except Exception as e:
            logger.error(f"Error parsing Weibo hot topics: {str(e)}")
        
        return topics

class ZhihuCrawler(BaseCrawler):
    def __init__(self):
        super().__init__()
        self.url = "https://www.zhihu.com/hot"
    
    def get_hot_topics(self):
        # 知乎需要登录才能访问热搜，这里使用Selenium模拟
        options = Options()
        options.add_argument('--headless')
        options.add_argument(f'user-agent={self.ua.random}')
        
        try:
            driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
            driver.get(self.url)
            time.sleep(5)  # 等待页面加载
            
            topics = []
            elements = driver.find_elements_by_css_selector('.HotItem-title')
            for element in elements[:50]:
                topics.append(element.text)
            
            driver.quit()
            return topics
        except Exception as e:
            logger.error(f"Error fetching Zhihu hot topics: {str(e)}")
            return []

class ToutiaoCrawler(BaseCrawler):
    def __init__(self):
        super().__init__()
        self.url = "https://www.toutiao.com/hot-event/hot-board/"
    
    def get_hot_topics(self):
        html = self.get_page(self.url)
        if not html:
            return []
        
        try:
            data = json.loads(html)
            topics = [item['Title'] for item in data['data']]
            return topics
        except Exception as e:
            logger.error(f"Error parsing Toutiao hot topics: {str(e)}")
            return []

class DouyinCrawler(BaseCrawler):
    def __init__(self):
        super().__init__()
        self.url = "https://www.douyin.com/hot"
    
    def get_hot_topics(self):
        # 抖音需要登录才能访问热搜，这里使用Selenium模拟
        options = Options()
        options.add_argument('--headless')
        options.add_argument(f'user-agent={self.ua.random}')
        
        try:
            driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
            driver.get(self.url)
            time.sleep(5)  # 等待页面加载
            
            topics = []
            elements = driver.find_elements_by_css_selector('.hot-search-item')
            for element in elements[:50]:
                topics.append(element.text)
            
            driver.quit()
            return topics
        except Exception as e:
            logger.error(f"Error fetching Douyin hot topics: {str(e)}")
            return []

class KuaishouCrawler(BaseCrawler):
    def __init__(self):
        super().__init__()
        self.url = "https://www.kuaishou.com/hot"
    
    def get_hot_topics(self):
        # 快手需要登录才能访问热搜，这里使用Selenium模拟
        options = Options()
        options.add_argument('--headless')
        options.add_argument(f'user-agent={self.ua.random}')
        
        try:
            driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
            driver.get(self.url)
            time.sleep(5)  # 等待页面加载
            
            topics = []
            elements = driver.find_elements_by_css_selector('.hot-topic-item')
            for element in elements[:50]:
                topics.append(element.text)
            
            driver.quit()
            return topics
        except Exception as e:
            logger.error(f"Error fetching Kuaishou hot topics: {str(e)}")
            return []

def save_to_excel(data, filename):
    df = pd.DataFrame(data)
    df.to_excel(filename, index=False)
    logger.info(f"Data saved to {filename}")

def main():
    crawlers = {
        '微博': WeiboCrawler(),
        '知乎': ZhihuCrawler(),
        '头条': ToutiaoCrawler(),
        '抖音': DouyinCrawler(),
        '快手': KuaishouCrawler()
    }
    
    results = {}
    for platform, crawler in crawlers.items():
        logger.info(f"Fetching hot topics from {platform}...")
        topics = crawler.get_hot_topics()
        results[platform] = topics
    
    # 保存结果
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'hot_topics_{timestamp}.xlsx'
    
    # 转换为DataFrame格式
    data = []
    for platform, topics in results.items():
        for i, topic in enumerate(topics, 1):
            data.append({
                '平台': platform,
                '排名': i,
                '话题': topic
            })
    
    save_to_excel(data, filename)

if __name__ == "__main__":
    main() 