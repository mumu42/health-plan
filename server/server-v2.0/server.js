// 引入express框架
const express = require('express');
const { initializeDatabase } = require('./config/database');
const corsMiddleware = require('./middleware/cors');

// 引入路由模块
const authRoutes = require('./routes/auth');
const checkinRoutes = require('./routes/checkin');
const userRoutes = require('./routes/user');
const groupRoutes = require('./routes/group');
const rankingRoutes = require('./routes/ranking');

// 创建express应用实例
const app = express();
// 设置服务器端口号为3001
const port = 3001;

// 使用CORS中间件
corsMiddleware(app);

// 初始化数据库
initializeDatabase();

// 使用express的JSON解析中间件，用于解析请求体中的JSON数据
app.use(express.json());

// 定义一个简单的测试路由，返回"Hello World!"
app.get('/test', (req, res) => {
  res.send('Hello World!');
});

// 注册路由模块
app.use('/', authRoutes);      // 登录相关
app.use('/', checkinRoutes);   // 打卡相关
app.use('/', userRoutes);      // 用户相关
app.use('/', groupRoutes);     // 群组相关
app.use('/', rankingRoutes);   // 排行榜相关

// 启动服务器，监听指定端口
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});