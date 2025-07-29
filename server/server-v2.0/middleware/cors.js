const cors = require('cors');

function corsMiddleware(app) {
  // 使用CORS中间件，允许跨域请求
  app.use(cors());

  // 处理预检请求
  app.options('*', cors());

  // 添加额外的CORS头部中间件
  app.use((req, res, next) => {
    // 设置CORS头部
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Forwarded-For, X-Real-IP');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });
}

module.exports = corsMiddleware;