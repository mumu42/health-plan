// 引入express框架
const express = require('express');
// 引入mysql2用于操作MySQL
const mysql = require('mysql2/promise');
// 引入CORS中间件用于处理跨域请求
const cors = require('cors');

// 创建express应用实例
const app = express();
// 设置服务器端口号为3001
const port = 3001;

// 使用CORS中间件，允许跨域请求 - 针对宝塔面板部署优化
app.use(cors({
  origin: function (origin, callback) {
    // 允许没有origin的请求（比如移动端应用、小程序等）
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      // 本地开发环境
      'http://localhost:3000',
      'http://127.0.0.1:3000', 
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      // 阿里云服务器
      'http://47.107.184.99:3000',
      'http://47.107.184.99:3001',
      'http://47.107.184.99',
      'https://47.107.184.99',
      // 域名访问（如果有域名的话）
      'http://47.107.184.99:80',
      'http://47.107.184.99:443',
      'https://47.107.184.99:80',
      'https://47.107.184.99:443'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS request from origin:', origin);
      // 生产环境允许所有origin，但记录日志
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Forwarded-For', 'X-Real-IP'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  maxAge: 86400 // 预检请求缓存24小时
}));

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

// 创建MySQL连接池
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root_hgz0521', // m5WnPB6SecKPDk5h
  database: 'health',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 初始化数据库表
async function initializeDatabase() {
  try {
    // 创建用户表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nickname VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        checkInCount INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建打卡记录表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT,
        groupId INT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('completed', 'skipped'),
        notes TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);

    // 创建群组表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`groups\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        creatorId INT,
        checkInCount INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creatorId) REFERENCES users(id)
      )
    `);

    // 创建群组成员关系表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        groupId INT,
        userId INT,
        PRIMARY KEY (groupId, userId),
        FOREIGN KEY (groupId) REFERENCES \`groups\`(id),
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// 初始化数据库
initializeDatabase();

// 使用express的JSON解析中间件，用于解析请求体中的JSON数据
app.use(express.json());

// 定义一个简单的测试路由，返回"Hello World!"
app.get('/test', (req, res) => {
  res.json({
    message: 'Hello World!',
    timestamp: new Date().toISOString(),
    cors: 'CORS is working!'
  });
});

// 添加CORS测试路由
app.get('/cors-test', (req, res) => {
  res.json({
    message: 'CORS test successful',
    origin: req.headers.origin,
    method: req.method,
    timestamp: new Date().toISOString(),
    headers: req.headers,
    server: 'Baota Panel Deployed Server'
  });
});

// 添加详细的CORS调试路由
app.get('/cors-debug', (req, res) => {
  console.log('CORS Debug Request:', {
    origin: req.headers.origin,
    method: req.method,
    headers: req.headers,
    url: req.url,
    timestamp: new Date().toISOString()
  });
  
  res.json({
    status: 'success',
    message: 'CORS debug information logged',
    requestInfo: {
      origin: req.headers.origin,
      method: req.method,
      userAgent: req.headers['user-agent'],
      accept: req.headers.accept,
      timestamp: new Date().toISOString()
    }
  });
});

// 定义登录接口，处理POST请求
app.post('/login', async (req, res) => {
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

// 修改打卡接口
app.post('/checkin', async (req, res) => {
  try {
    const { userId, groupId, status, notes } = req.body;
    
    // 验证用户是否存在
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    // 处理groupId参数，确保是有效的整数或null
    let processedGroupId = null;
    if (groupId !== null && groupId !== undefined && groupId !== '') {
      const parsedGroupId = parseInt(groupId);
      if (!isNaN(parsedGroupId)) {
        processedGroupId = parsedGroupId;
      }
    }

    // 获取今天的开始和结束时间
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 检查今天是否已经打卡
    const [existingChecks] = await pool.query(
      'SELECT * FROM checks WHERE userId = ? AND date BETWEEN ? AND ?',
      [userId, todayStart, todayEnd]
    );

    if (existingChecks.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '今天已经打卡过了',
        data: {
          checkId: existingChecks[0].id,
          status: existingChecks[0].status
        }
      });
    }

    // 创建打卡记录
    const [checkResult] = await pool.query(
      'INSERT INTO checks (userId, groupId, status, notes) VALUES (?, ?, ?, ?)',
      [userId, processedGroupId, status, notes]
    );

    // 根据打卡状态决定累加值
    const incrementValue = status === 'completed' ? 1 : 0;
    
    // 更新用户打卡次数
    await pool.query(
      'UPDATE users SET checkInCount = checkInCount + ? WHERE id = ?',
      [incrementValue, userId]
    );
    
    // 更新群组打卡次数
    if (processedGroupId) {
      await pool.query(
        'UPDATE `groups` SET checkInCount = checkInCount + ? WHERE id = ?',
        [incrementValue, processedGroupId]
      );
    }

    // 获取更新后的数据
    const [updatedUser] = await pool.query('SELECT checkInCount FROM users WHERE id = ?', [userId]);
    let updatedGroup = [{ checkInCount: null }];
    
    if (processedGroupId) {
      const [groupResult] = await pool.query('SELECT checkInCount FROM `groups` WHERE id = ?', [processedGroupId]);
      if (groupResult.length > 0) {
        updatedGroup = groupResult;
      }
    }

    res.status(200).json({
      code: 200,
      data: {
        checkId: checkResult.insertId,
        userId,
        groupId: processedGroupId,
        date: new Date(),
        status,
        userCheckInCount: updatedUser[0].checkInCount,
        groupCheckInCount: updatedGroup[0].checkInCount
      },
      message: '打卡成功'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义获取用户打卡记录接口，处理GET请求
app.get('/checks/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 验证用户是否存在
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    // 查询该用户的所有打卡记录，按日期降序排列
    const [checks] = await pool.query(
      'SELECT * FROM checks WHERE userId = ? ORDER BY date DESC',
      [userId]
    );

    res.status(200).json({
      code: 200,
      data: checks.map(check => ({
        id: check.id,
        date: check.date,
        status: check.status,
        notes: check.notes
      })),
      message: '获取打卡记录成功'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义创建群组接口，处理POST请求
app.post('/groups', async (req, res) => {
  try {
    const { name, creatorId, memberIds = [] } = req.body;
    
    // 验证创建者是否存在
    const [creators] = await pool.query('SELECT * FROM users WHERE id = ?', [creatorId]);
    if (creators.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '创建者不存在'
      });
    }

    // 验证群组名称是否已存在
    const [existingGroups] = await pool.query('SELECT * FROM `groups` WHERE name = ?', [name]);
    if (existingGroups.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '群组名称已存在'
      });
    }

    // 开始事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 创建新群组
      const [groupResult] = await connection.query(
        'INSERT INTO `groups` (name, creatorId) VALUES (?, ?)',
        [name, creatorId]
      );
      const groupId = groupResult.insertId;

      // 添加创建者为群组成员
      await connection.query(
        'INSERT INTO group_members (groupId, userId) VALUES (?, ?)',
        [groupId, creatorId]
      );

      // 添加其他成员，跳过创建者自己并去重
      const uniqueMemberIds = [...new Set(memberIds)].filter(id => 
        id !== creatorId && id != null && id !== undefined
      );
      
      for (const memberId of uniqueMemberIds) {
        // 检查是否已经是成员，避免重复插入
        const [existingMember] = await connection.query(
          'SELECT * FROM group_members WHERE groupId = ? AND userId = ?',
          [groupId, memberId]
        );
        
        if (existingMember.length === 0) {
          await connection.query(
            'INSERT INTO group_members (groupId, userId) VALUES (?, ?)',
            [groupId, memberId]
          );
        }
      }

      // 提交事务
      await connection.commit();

      // 获取群组信息
      const [group] = await pool.query(
        `SELECT g.*, 
         GROUP_CONCAT(u.id) as memberIds,
         GROUP_CONCAT(u.nickname) as memberNicknames,
         GROUP_CONCAT(u.checkInCount) as memberCheckInCounts
         FROM \`groups\` g
         LEFT JOIN group_members gm ON g.id = gm.groupId
         LEFT JOIN users u ON gm.userId = u.id
         WHERE g.id = ?
         GROUP BY g.id`,
        [groupId]
      );

      const members = group[0].memberIds ? group[0].memberIds.split(',').map((id, index) => ({
        _id: parseInt(id),
        nickname: group[0].memberNicknames.split(',')[index],
        checkInCount: parseInt(group[0].memberCheckInCounts.split(',')[index])
      })) : [];

      res.status(200).json({
        code: 200,
        data: {
          id: group[0].id,
          name: group[0].name,
          creator: group[0].creatorId,
          members,
          createdAt: group[0].created_at
        },
        message: '群组创建成功'
      });
    } catch (error) {
      // 如果出错，回滚事务
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义获取创建者的所有群组接口，处理GET请求
app.get('/groups/creator/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    
    // 验证创建者是否存在
    const [creators] = await pool.query('SELECT * FROM users WHERE id = ?', [creatorId]);
    if (creators.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '创建者不存在'
      });
    }

    // 查询该创建者的所有群组
    const [groups] = await pool.query(
      `SELECT g.*, 
       GROUP_CONCAT(u.id) as memberIds,
       GROUP_CONCAT(u.nickname) as memberNicknames,
       GROUP_CONCAT(u.checkInCount) as memberCheckInCounts
       FROM \`groups\` g
       LEFT JOIN group_members gm ON g.id = gm.groupId
       LEFT JOIN users u ON gm.userId = u.id
       WHERE g.creatorId = ?
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [creatorId]
    );

    const formattedGroups = groups.map(group => ({
      id: group.id,
      name: group.name,
      creator: group.creatorId,
      members: group.memberIds ? group.memberIds.split(',').map((id, index) => ({
        _id: parseInt(id),
        nickname: group.memberNicknames.split(',')[index],
        checkInCount: parseInt(group.memberCheckInCounts.split(',')[index])
      })) : [],
      createdAt: group.created_at
    }));

    res.status(200).json({
      code: 200,
      data: formattedGroups,
      message: '获取群组列表成功'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义群主转让接口，处理POST请求
app.post('/groups/:groupId/transferOwner', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { currentOwnerId, newOwnerId } = req.body;

    // 验证群组是否存在
    const [groups] = await pool.query('SELECT * FROM `groups` WHERE id = ?', [groupId]);
    if (groups.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '群组不存在'
      });
    }

    // 验证当前请求者是否为群主
    if (groups[0].creatorId !== currentOwnerId) {
      return res.status(403).json({
        code: 403,
        message: '只有群主可以转让群组所有权'
      });
    }

    // 验证新群主是否为群组成员
    const [members] = await pool.query(
      'SELECT * FROM group_members WHERE groupId = ? AND userId = ?',
      [groupId, newOwnerId]
    );
    if (members.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '指定的新群主不是群组成员'
      });
    }

    // 转让群主权限
    await pool.query(
      'UPDATE `groups` SET creatorId = ? WHERE id = ?',
      [newOwnerId, groupId]
    );

    res.status(200).json({
      code: 200,
      message: '群主转让成功',
      data: {
        groupId: parseInt(groupId),
        newCreator: newOwnerId
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义根据组成员ID搜索所在组的接口，处理GET请求
app.get('/groups/member/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;

    // 查询该成员所在的所有组
    const [groups] = await pool.query(
      `SELECT g.*, 
       GROUP_CONCAT(u.id) as memberIds,
       GROUP_CONCAT(u.nickname) as memberNicknames,
       GROUP_CONCAT(u.checkInCount) as memberCheckInCounts
       FROM \`groups\` g
       JOIN group_members gm ON g.id = gm.groupId
       LEFT JOIN group_members gm2 ON g.id = gm2.groupId
       LEFT JOIN users u ON gm2.userId = u.id
       WHERE gm.userId = ?
       GROUP BY g.id`,
      [memberId]
    );

    const formattedGroups = groups.map(group => ({
      id: group.id,
      name: group.name,
      creator: group.creatorId,
      members: group.memberIds ? group.memberIds.split(',').map((id, index) => ({
        _id: parseInt(id),
        nickname: group.memberNicknames.split(',')[index],
        checkInCount: parseInt(group.memberCheckInCounts.split(',')[index])
      })) : [],
      createdAt: group.created_at
    }));

    res.status(200).json({
      code: 200,
      data: formattedGroups,
      message: '获取成员所在组成功'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义根据名称搜索群组接口，处理GET请求
app.get('/groups/search', async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        code: 400,
        message: '请输入群组名称'
      });
    }

    // 使用LIKE进行模糊搜索
    const [groups] = await pool.query(
      `SELECT g.*, COUNT(gm.userId) as memberCount
       FROM \`groups\` g
       LEFT JOIN group_members gm ON g.id = gm.groupId
       WHERE g.name LIKE ?
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [`%${name}%`]
    );

    res.status(200).json({
      code: 200,
      data: groups.map(group => ({
        id: group.id,
        name: group.name,
        creator: group.creatorId,
        memberCount: group.memberCount,
        createdAt: group.created_at
      })),
      message: '搜索成功'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义加入群组接口，处理POST请求
app.post('/groups/:groupId/join', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    
    // 验证用户是否存在
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    // 验证群组是否存在
    const [groups] = await pool.query('SELECT * FROM `groups` WHERE id = ?', [groupId]);
    if (groups.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '群组不存在'
      });
    }

    // 检查用户是否已在群组中
    const [existingMembers] = await pool.query(
      'SELECT * FROM group_members WHERE groupId = ? AND userId = ?',
      [groupId, userId]
    );
    if (existingMembers.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '用户已在群组中'
      });
    }

    // 添加用户到群组
    await pool.query(
      'INSERT INTO group_members (groupId, userId) VALUES (?, ?)',
      [groupId, userId]
    );

    // 获取更新后的群组信息
    const [updatedGroup] = await pool.query(
      `SELECT g.*, 
       GROUP_CONCAT(u.id) as memberIds,
       GROUP_CONCAT(u.nickname) as memberNicknames,
       GROUP_CONCAT(u.checkInCount) as memberCheckInCounts
       FROM \`groups\` g
       LEFT JOIN group_members gm ON g.id = gm.groupId
       LEFT JOIN users u ON gm.userId = u.id
       WHERE g.id = ?
       GROUP BY g.id`,
      [groupId]
    );

    const members = updatedGroup[0].memberIds ? updatedGroup[0].memberIds.split(',').map((id, index) => ({
      _id: parseInt(id),
      nickname: updatedGroup[0].memberNicknames.split(',')[index],
      checkInCount: parseInt(updatedGroup[0].memberCheckInCounts.split(',')[index])
    })) : [];

    res.status(200).json({
      code: 200,
      data: {
        groupId: parseInt(groupId),
        name: updatedGroup[0].name,
        members
      },
      message: '加入群组成功'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义获取用户排行榜接口，按打卡次数倒序排序
app.get('/users/ranking', async (req, res) => {
  try {
    // 查询所有用户，按打卡次数倒序排序
    const [users] = await pool.query(
      'SELECT nickname, checkInCount FROM users ORDER BY checkInCount DESC'
    );

    res.status(200).json({
      code: 200,
      data: users,
      message: '获取排行榜成功'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义获取群组排行榜接口，按打卡次数倒序排序
app.get('/groups/ranking', async (req, res) => {
  try {
    // 查询所有群组，按打卡次数倒序排序
    const [groups] = await pool.query(
      `SELECT g.*, 
       GROUP_CONCAT(u.nickname) as memberNicknames,
       COUNT(gm.userId) as memberCount
       FROM \`groups\` g
       LEFT JOIN group_members gm ON g.id = gm.groupId
       LEFT JOIN users u ON gm.userId = u.id
       GROUP BY g.id
       ORDER BY g.checkInCount DESC`
    );

    res.status(200).json({
      code: 200,
      data: groups.map(group => ({
        name: group.name,
        checkInCount: group.checkInCount,
        memberCount: group.memberCount,
        members: group.memberNicknames ? group.memberNicknames.split(',') : []
      })),
      message: '获取群组排行榜成功'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义根据群组id删除群组接口，处理POST请求
app.post('/deleteGroup', async (req, res) => {
  try {
    const { userId, groupId } = req.body;

    // 验证群组是否存在
    const [groups] = await pool.query('SELECT * FROM `groups` WHERE id = ?', [groupId]);
    if (groups.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '群组不存在'
      });
    }

    // 验证请求者是否为群主
    if (groups[0].creatorId !== userId) {
      return res.status(403).json({
        code: 403,
        message: '只有群主可以删除群组'
      });
    }

    // 开始事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 删除群组成员关系
      await connection.query('DELETE FROM group_members WHERE groupId = ?', [groupId]);
      // 删除群组
      await connection.query('DELETE FROM `groups` WHERE id = ?', [groupId]);
      // 提交事务
      await connection.commit();

      res.status(200).json({
        code: 200,
        message: '群组删除成功'
      });
    } catch (error) {
      // 如果出错，回滚事务
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义根据群组成员ID删除群组成员接口，处理POST请求
app.post('/groups/:groupId/removeMember', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId, memberId } = req.body;

    // 验证群组是否存在
    const [groups] = await pool.query('SELECT * FROM `groups` WHERE id = ?', [groupId]);
    if (groups.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '群组不存在'
      });
    }

    // 验证请求者是否为群主
    if (groups[0].creatorId !== userId) {
      return res.status(403).json({
        code: 403,
        message: '只有群主可以删除群组成员'
      });
    }

    // 检查要删除的成员是否存在于群组中
    const [ members ] = await pool.query(
      'SELECT * FROM group_members WHERE groupId = ? AND userId = ?',
      [groupId, memberId]
    );
    if (members.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '群组成员不存在'
      });
    }

    // 检查要删除的成员是否是群主
    if (groups[0].creatorId === memberId) {
      // 获取群组其他成员
      const [otherMembers] = await pool.query(
        'SELECT userId FROM group_members WHERE groupId = ? AND userId != ?',
        [groupId, memberId]
      );

      if (otherMembers.length === 0) {
        return res.status(400).json({
          code: 400,
          message: '群组中只有群主一名成员，无法删除'
        });
      }

      // 将下一个成员设为新群主
      await pool.query(
        'UPDATE `groups` SET creatorId = ? WHERE id = ?',
        [otherMembers[0].userId, groupId]
      );
    }

    // 删除群组成员
    await pool.query(
      'DELETE FROM group_members WHERE groupId = ? AND userId = ?',
      [groupId, memberId]
    );

    // 获取更新后的群组信息
    const [updatedGroup] = await pool.query(
      `SELECT g.*, 
       GROUP_CONCAT(u.id) as memberIds,
       GROUP_CONCAT(u.nickname) as memberNicknames,
       GROUP_CONCAT(u.checkInCount) as memberCheckInCounts
       FROM \`groups\` g
       LEFT JOIN group_members gm ON g.id = gm.groupId
       LEFT JOIN users u ON gm.userId = u.id
       WHERE g.id = ?
       GROUP BY g.id`,
      [groupId]
    );

    const members1 = updatedGroup[0].memberIds ? updatedGroup[0].memberIds.split(',').map((id, index) => ({
      _id: parseInt(id),
      nickname: updatedGroup[0].memberNicknames.split(',')[index],
      checkInCount: parseInt(updatedGroup[0].memberCheckInCounts.split(',')[index])
    })) : [];

    res.status(200).json({
      code: 200,
      message: '群组成员删除成功',
      data: {
        groupId: parseInt(groupId),
        members: members1,
        creator: updatedGroup[0].creatorId
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义根据用户ID查询未加入群组的接口，处理GET请求
app.get('/groups/not-joined/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // 查询用户未加入的所有群组
    const [groups] = await pool.query(
      `SELECT g.*, 
       GROUP_CONCAT(u.id) as memberIds,
       GROUP_CONCAT(u.nickname) as memberNicknames,
       GROUP_CONCAT(u.checkInCount) as memberCheckInCounts
       FROM \`groups\` g
       LEFT JOIN group_members gm ON g.id = gm.groupId
       LEFT JOIN users u ON gm.userId = u.id
       WHERE g.id NOT IN (
         SELECT groupId FROM group_members WHERE userId = ?
       )
       GROUP BY g.id`,
      [userId]
    );

    const formattedGroups = groups.map(group => ({
      id: group.id,
      name: group.name,
      creator: group.creatorId,
      members: group.memberIds ? group.memberIds.split(',').map((id, index) => ({
        _id: parseInt(id),
        nickname: group.memberNicknames.split(',')[index],
        checkInCount: parseInt(group.memberCheckInCounts.split(',')[index])
      })) : [],
      createdAt: group.created_at
    }));

    res.status(200).json({
      code: 200,
      data: formattedGroups,
      message: '获取用户未加入的群组成功'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义查询所有群组接口，处理GET请求
app.get('/groupList', async (req, res) => {
  try {
    // 查询所有群组，按创建时间降序排列
    const [groups] = await pool.query(
      `SELECT g.*, 
       GROUP_CONCAT(u.id) as memberIds,
       GROUP_CONCAT(u.nickname) as memberNicknames,
       GROUP_CONCAT(u.checkInCount) as memberCheckInCounts
       FROM \`groups\` g
       LEFT JOIN group_members gm ON g.id = gm.groupId
       LEFT JOIN users u ON gm.userId = u.id
       GROUP BY g.id
       ORDER BY g.created_at DESC`
    );

    const formattedGroups = groups.map(group => ({
      id: group.id,
      name: group.name,
      creator: group.creatorId,
      members: group.memberIds ? group.memberIds.split(',').map((id, index) => ({
        _id: parseInt(id),
        nickname: group.memberNicknames.split(',')[index],
        checkInCount: parseInt(group.memberCheckInCounts.split(',')[index])
      })) : [],
      createdAt: group.created_at,
      checkInCount: group.checkInCount
    }));

    res.status(200).json({
      code: 200,
      data: formattedGroups,
      message: '获取所有群组成功'
    });
  } catch (error) {
    console.error('Error:', error);
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