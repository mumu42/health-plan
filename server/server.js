// 引入express框架
const express = require('express');
// 引入mongoose用于操作MongoDB
const mongoose = require('mongoose');
// 引入CORS中间件用于处理跨域请求
const cors = require('cors');

// 创建express应用实例
const app = express();
// 设置服务器端口号为3001
const port = 3001;

// 使用CORS中间件，允许跨域请求
app.use(cors());

// 连接到本地MongoDB数据库
mongoose.connect('mongodb://localhost:27017/healthdatabase', {
  useNewUrlParser: true,  // 使用新的URL解析器
  useUnifiedTopology: true  // 使用统一的拓扑结构
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

// 使用express的JSON解析中间件，用于解析请求体中的JSON数据
app.use(express.json());

// 定义一个简单的测试路由，返回"Hello World!"
app.get('/test', (req, res) => {
  res.send('Hello World!');
});

// 定义用户模型Schema
const userSchema = new mongoose.Schema({
  nickname: String,  // 用户昵称字段
  password: String  // 用户密码字段
});
// 创建User模型，并指定集合名称为'user'
const User = mongoose.model('User', userSchema, 'user');
console.log('User===', User)

// 定义登录接口，处理POST请求
app.post('/login', async (req, res) => {
  try {
    // 从请求体中获取昵称和密码
    const { nickname, password } = req.body;
    console.log('User=', User)
    // 在数据库中查找匹配的用户
    const user = await User.findOne({ nickname, password });
    console.log('user111=', user)
    if (user) {
      // 如果找到用户，返回成功响应
      res.status(200).json({
        code: 200,
        data: { 
          id: user._id,  // 用户ID
          nickname: user.nickname  // 用户昵称
        },
        message: '登录成功'
      });
    } else {
      // 如果未找到用户，返回认证失败响应
      const register = await User.findOne({ nickname });
      if (register) {
        res.status(401).json({
          code: 401,
          message: '用户名和密码无法匹配~'
        });
      } else {
        try {
          // 创建新用户
          const newUser = new User({ nickname, password });
          // 保存用户到数据库
          await newUser.save();

          res.status(200).json({
            code: 200,
            data: { 
              id: user._id,  // 用户ID
              nickname: user.nickname  // 用户昵称
            },
            message: '登录成功'
          });

        } catch (error) {
            // 捕获并处理异常，返回服务器错误响应
            res.status(500).json({
              code: 500,
              message: '服务器错误'
            });
        }
      }
      
    }
  } catch (error) {
    // 捕获并处理异常，返回服务器错误响应
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 启动服务器，监听指定端口
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});