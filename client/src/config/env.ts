// 环境配置
const env = process.env.NODE_ENV || 'development';

const config = {
  development: {
    baseURL: 'http://localhost:3001',
    timeout: 10000
  },
  production: {
    baseURL: 'http://47.107.184.99:3001', // 阿里云服务器地址
    timeout: 15000 // 生产环境增加超时时间
  },
  test: {
    baseURL: 'http://localhost:3001',
    timeout: 10000
  }
};

// 如果是在宝塔面板部署，强制使用生产环境配置
const isBaotaDeploy = process.env.BAOTA_DEPLOY === 'true' || 
                      window.location.hostname === '47.107.184.99' ||
                      window.location.hostname.includes('47.107.184.99');

export default isBaotaDeploy ? config.production : (config[env] || config.development); 