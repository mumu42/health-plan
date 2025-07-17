// 环境配置
// 判断是否为浏览器环境
const isBrowser = typeof window !== 'undefined';

// 获取环境变量（只在非浏览器环境中访问 process）
const env = !isBrowser ? (process.env.NODE_ENV || 'development') : 'development';

const config = {
  development: {
    baseURL: 'http://47.107.184.99:3001',
    timeout: 10000
  },
  production: {
    baseURL: 'http://47.107.184.99:3001', // 阿里云服务器地址
    timeout: 15000 // 生产环境增加超时时间
  },
  test: {
    baseURL: 'http://47.107.184.99:3001',
    timeout: 10000
  }
};

// 如果是在宝塔面板部署，强制使用生产环境配置
const isBaotaDeploy = !isBrowser && process.env.BAOTA_DEPLOY === 'true' || 
                      window.location.hostname === '47.107.184.99' ||
                      window.location.hostname.includes('47.107.184.99');

export default isBaotaDeploy ? config.production : (config[env] || config.development); 