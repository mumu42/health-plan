const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// 定义登录接口，处理POST请求
router.post('/login', async (req, res) => {
    try {
      const { nickname, password } = req.body;
      
      // 查找用户
      const [users] = await pool.query(
        'SELECT * FROM users WHERE nickname = ? AND password = ?',
        [nickname, password]
      );
  
      if (users.length > 0) {
        res.status(200).json({
          code: 200,
          data: {
            id: users[0].id,
            nickname: users[0].nickname
          },
          message: '登录成功'
        });
      } else {
        // 检查用户是否存在
        const [existingUsers] = await pool.query(
          'SELECT * FROM users WHERE nickname = ?',
          [nickname]
        );
  
        if (existingUsers.length > 0) {
          res.status(401).json({
            code: 401,
            message: '用户名和密码无法匹配~'
          });
        } else {
          // 创建新用户
          const [result] = await pool.query(
            'INSERT INTO users (nickname, password) VALUES (?, ?)',
            [nickname, password]
          );
  
          res.status(200).json({
            code: 200,
            data: {
              id: result.insertId,
              nickname: nickname
            },
            message: '登录成功'
          });
        }
      }
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({
        code: 500,
        message: '服务器错误'
      });
    }
  });

module.exports = router;