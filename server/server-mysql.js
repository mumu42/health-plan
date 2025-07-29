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

// 创建MySQL连接池
const pool = mysql.createPool({
  host: 'localhost',
  user: 'yourname',
  password: 'yourpassword',
  database: 'yourbase',
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
        status ENUM('completed', 'skipped') DEFAULT 'completed',
        exerciseType VARCHAR(50),
        startTime VARCHAR(10),
        endTime VARCHAR(10),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id),
        INDEX idx_user_date (userId, date),
        INDEX idx_date (date)
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

    console.log(new Date() + ' Database initialized successfully');
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
  res.send('Hello World!');
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
// 修改打卡接口，支持新的字段
app.post('/checkin', async (req, res) => {
  try {
    const { userId, groupId, status, notes, exerciseType, startTime, endTime } = req.body;
    
    // 验证用户是否存在
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    // 处理groupId参数
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
          status: existingChecks[0].status,
          exerciseType: existingChecks[0].exerciseType,
          startTime: existingChecks[0].startTime,
          endTime: existingChecks[0].endTime
        }
      });
    }

    // 创建打卡记录，包含新字段
    const [checkResult] = await pool.query(
      'INSERT INTO checks (userId, groupId, status, notes, exerciseType, startTime, endTime) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, processedGroupId, status || 'completed', notes || '', exerciseType || '', startTime || '', endTime || '']
    );

    // 根据打卡状态决定累加值
    const incrementValue = (status || 'completed') === 'completed' ? 1 : 0;
    
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
        status: status || 'completed',
        exerciseType: exerciseType || '',
        startTime: startTime || '',
        endTime: endTime || '',
        notes: notes || '',
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

// 定义获取用户上周签到数据接口，处理GET请求
app.get('/checks/:userId/lastweek', async (req, res) => {
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

    // 计算上周的开始和结束时间
    const now = new Date();
    const currentDay = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
    const daysToLastSunday = currentDay === 0 ? 7 : currentDay; // 如果今天是周日，则上周日是7天前
    
    // 上周日的开始时间
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - daysToLastSunday - 6); // 上周一
    lastWeekStart.setHours(0, 0, 0, 0);
    
    // 上周六的结束时间
    const lastWeekEnd = new Date(now);
    lastWeekEnd.setDate(now.getDate() - daysToLastSunday); // 上周日
    lastWeekEnd.setHours(23, 59, 59, 999);

    console.log('查询上周时间范围:', {
      start: lastWeekStart.toLocaleString('zh-CN'),
      end: lastWeekEnd.toLocaleString('zh-CN')
    });

    // 查询上周的签到记录
    const [checks] = await pool.query(
      `SELECT 
        id,
        date,
        status,
        exerciseType,
        startTime,
        endTime,
        notes,
        created_at
       FROM checks 
       WHERE userId = ? 
         AND date BETWEEN ? AND ?
       ORDER BY date ASC`,
      [userId, lastWeekStart, lastWeekEnd]
    );

    // 格式化数据，包含每天的详细信息
    const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const formattedData = [];
    
    // 生成上周7天的完整数据
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(lastWeekStart);
      currentDate.setDate(lastWeekStart.getDate() + i);
      
      // 查找当天的签到记录
      const dayCheck = checks.find(check => {
        const checkDate = new Date(check.date);
        return checkDate.toDateString() === currentDate.toDateString();
      });
      
      formattedData.push({
        date: currentDate.toISOString().split('T')[0], // YYYY-MM-DD 格式
        dayName: weekDays[i],
        hasCheckedIn: !!dayCheck,
        checkInData: dayCheck ? {
          id: dayCheck.id,
          status: dayCheck.status,
          exerciseType: dayCheck.exerciseType,
          startTime: dayCheck.startTime,
          endTime: dayCheck.endTime,
          notes: dayCheck.notes,
          checkInTime: dayCheck.date
        } : null
      });
    }

    // 计算统计信息
    const totalDays = 7;
    const checkedInDays = checks.length;
    const completedDays = checks.filter(check => check.status === 'completed').length;
    const skippedDays = checks.filter(check => check.status === 'skipped').length;
    const checkInRate = ((checkedInDays / totalDays) * 100).toFixed(1);

    // 统计运动类型
    const exerciseTypeStats = {};
    checks.forEach(check => {
      if (check.exerciseType) {
        exerciseTypeStats[check.exerciseType] = (exerciseTypeStats[check.exerciseType] || 0) + 1;
      }
    });

    res.status(200).json({
      code: 200,
      data: {
        userId: parseInt(userId),
        weekPeriod: {
          start: lastWeekStart.toISOString().split('T')[0],
          end: lastWeekEnd.toISOString().split('T')[0],
          description: '上周'
        },
        statistics: {
          totalDays,
          checkedInDays,
          completedDays,
          skippedDays,
          checkInRate: `${checkInRate}%`,
          exerciseTypeStats
        },
        dailyData: formattedData,
        rawChecks: checks.map(check => ({
          id: check.id,
          date: check.date,
          status: check.status,
          exerciseType: check.exerciseType,
          startTime: check.startTime,
          endTime: check.endTime,
          notes: check.notes,
          createdAt: check.created_at
        }))
      },
      message: '获取上周签到数据成功'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义获取指定周签到数据的接口（可选，更灵活）
app.get('/checks/:userId/week', async (req, res) => {
  try {
    const { userId } = req.params;
    const { weekOffset = -1 } = req.query; // weekOffset: 0=本周, -1=上周, -2=上上周
    
    // 验证用户是否存在
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    // 计算指定周的开始和结束时间
    const now = new Date();
    const currentDay = now.getDay();
    const daysToThisWeekStart = currentDay === 0 ? 6 : currentDay - 1; // 本周一距离今天的天数
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToThisWeekStart + (parseInt(weekOffset) * 7));
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // 查询指定周的签到记录
    const [checks] = await pool.query(
      `SELECT 
        id, date, status, exerciseType, startTime, endTime, notes, created_at
       FROM checks 
       WHERE userId = ? AND date BETWEEN ? AND ?
       ORDER BY date ASC`,
      [userId, weekStart, weekEnd]
    );

    // 格式化返回数据（与上面类似的逻辑）
    const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const formattedData = [];
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + i);
      
      const dayCheck = checks.find(check => {
        const checkDate = new Date(check.date);
        return checkDate.toDateString() === currentDate.toDateString();
      });
      
      formattedData.push({
        date: currentDate.toISOString().split('T')[0],
        dayName: weekDays[i],
        hasCheckedIn: !!dayCheck,
        checkInData: dayCheck ? {
          id: dayCheck.id,
          status: dayCheck.status,
          exerciseType: dayCheck.exerciseType,
          startTime: dayCheck.startTime,
          endTime: dayCheck.endTime,
          notes: dayCheck.notes,
          checkInTime: dayCheck.date
        } : null
      });
    }

    const totalDays = 7;
    const checkedInDays = checks.length;
    const checkInRate = ((checkedInDays / totalDays) * 100).toFixed(1);

    let weekDescription = '';
    if (weekOffset == 0) weekDescription = '本周';
    else if (weekOffset == -1) weekDescription = '上周';
    else if (weekOffset < -1) weekDescription = `${Math.abs(weekOffset)}周前`;
    else weekDescription = `${weekOffset}周后`;

    res.status(200).json({
      code: 200,
      data: {
        userId: parseInt(userId),
        weekOffset: parseInt(weekOffset),
        weekPeriod: {
          start: weekStart.toISOString().split('T')[0],
          end: weekEnd.toISOString().split('T')[0],
          description: weekDescription
        },
        statistics: {
          totalDays,
          checkedInDays,
          checkInRate: `${checkInRate}%`
        },
        dailyData: formattedData
      },
      message: `获取${weekDescription}签到数据成功`
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义获取用户当天打卡信息接口，处理GET请求
app.get('/checks/:userId/today', async (req, res) => {
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

    // 获取今天的开始和结束时间
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    console.log('查询今天打卡时间范围:', {
      start: todayStart.toLocaleString('zh-CN'),
      end: todayEnd.toLocaleString('zh-CN')
    });

    // 查询今天的打卡记录
    const [checks] = await pool.query(
      `SELECT 
        c.id,
        c.userId,
        c.groupId,
        c.date,
        c.status,
        c.exerciseType,
        c.startTime,
        c.endTime,
        c.notes,
        c.created_at,
        c.updated_at,
        g.name as groupName
       FROM checks c
       LEFT JOIN \`groups\` g ON c.groupId = g.id
       WHERE c.userId = ? 
         AND c.date BETWEEN ? AND ?
       ORDER BY c.created_at DESC
       LIMIT 1`,
      [userId, todayStart, todayEnd]
    );

    // 获取用户基本信息
    const [userInfo] = await pool.query(
      'SELECT id, nickname, checkInCount FROM users WHERE id = ?',
      [userId]
    );

    // 今天的日期信息
    const today = new Date();
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const todayInfo = {
      date: today.toISOString().split('T')[0], // YYYY-MM-DD 格式
      dayName: weekDays[today.getDay()],
      fullDate: today.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    };

    if (checks.length > 0) {
      const checkData = checks[0];
      
      // 计算运动时长（如果有开始和结束时间）
      let duration = null;
      if (checkData.startTime && checkData.endTime) {
        const start = new Date(`2000-01-01 ${checkData.startTime}`);
        const end = new Date(`2000-01-01 ${checkData.endTime}`);
        if (end > start) {
          const durationMs = end.getTime() - start.getTime();
          const hours = Math.floor(durationMs / (1000 * 60 * 60));
          const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
          duration = {
            hours,
            minutes,
            totalMinutes: Math.floor(durationMs / (1000 * 60)),
            formatted: hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`
          };
        }
      }

      res.status(200).json({
        code: 200,
        data: {
          hasCheckedIn: true,
          todayInfo,
          userInfo: userInfo[0],
          checkInData: {
            id: checkData.id,
            userId: checkData.userId,
            groupId: checkData.groupId,
            groupName: checkData.groupName,
            date: checkData.date,
            status: checkData.status,
            exerciseType: checkData.exerciseType,
            startTime: checkData.startTime,
            endTime: checkData.endTime,
            duration,
            notes: checkData.notes,
            checkInTime: checkData.date,
            createdAt: checkData.created_at,
            updatedAt: checkData.updated_at
          }
        },
        message: '获取今日打卡信息成功'
      });
    } else {
      res.status(200).json({
        code: 200,
        data: {
          hasCheckedIn: false,
          todayInfo,
          userInfo: userInfo[0],
          checkInData: null
        },
        message: '今日尚未打卡'
      });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义获取指定日期打卡信息接口，处理GET请求（可选，更灵活）
app.get('/checks/:userId/date/:date', async (req, res) => {
  try {
    const { userId, date } = req.params;
    
    // 验证用户是否存在
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    // 验证日期格式 YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        code: 400,
        message: '日期格式错误，请使用 YYYY-MM-DD 格式'
      });
    }

    // 构造查询日期的开始和结束时间
    const queryDate = new Date(date);
    if (isNaN(queryDate.getTime())) {
      return res.status(400).json({
        code: 400,
        message: '无效的日期'
      });
    }

    const dayStart = new Date(queryDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(queryDate);
    dayEnd.setHours(23, 59, 59, 999);

    // 查询指定日期的打卡记录
    const [checks] = await pool.query(
      `SELECT 
        c.id,
        c.userId,
        c.groupId,
        c.date,
        c.status,
        c.exerciseType,
        c.startTime,
        c.endTime,
        c.notes,
        c.created_at,
        c.updated_at,
        g.name as groupName
       FROM checks c
       LEFT JOIN \`groups\` g ON c.groupId = g.id
       WHERE c.userId = ? 
         AND c.date BETWEEN ? AND ?
       ORDER BY c.created_at DESC`,
      [userId, dayStart, dayEnd]
    );

    // 日期信息
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dateInfo = {
      date: date,
      dayName: weekDays[queryDate.getDay()],
      fullDate: queryDate.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      isToday: date === new Date().toISOString().split('T')[0]
    };

    // 获取用户基本信息
    const [userInfo] = await pool.query(
      'SELECT id, nickname, checkInCount FROM users WHERE id = ?',
      [userId]
    );

    if (checks.length > 0) {
      // 可能有多条记录，返回所有记录
      const checkInRecords = checks.map(checkData => {
        // 计算运动时长
        let duration = null;
        if (checkData.startTime && checkData.endTime) {
          const start = new Date(`2000-01-01 ${checkData.startTime}`);
          const end = new Date(`2000-01-01 ${checkData.endTime}`);
          if (end > start) {
            const durationMs = end.getTime() - start.getTime();
            const hours = Math.floor(durationMs / (1000 * 60 * 60));
            const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
            duration = {
              hours,
              minutes,
              totalMinutes: Math.floor(durationMs / (1000 * 60)),
              formatted: hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`
            };
          }
        }

        return {
          id: checkData.id,
          userId: checkData.userId,
          groupId: checkData.groupId,
          groupName: checkData.groupName,
          date: checkData.date,
          status: checkData.status,
          exerciseType: checkData.exerciseType,
          startTime: checkData.startTime,
          endTime: checkData.endTime,
          duration,
          notes: checkData.notes,
          checkInTime: checkData.date,
          createdAt: checkData.created_at,
          updatedAt: checkData.updated_at
        };
      });

      res.status(200).json({
        code: 200,
        data: {
          hasCheckedIn: true,
          dateInfo,
          userInfo: userInfo[0],
          checkInRecords,
          primaryCheckIn: checkInRecords[0], // 主要打卡记录（最新的）
          totalRecords: checkInRecords.length
        },
        message: `获取 ${date} 打卡信息成功`
      });
    } else {
      res.status(200).json({
        code: 200,
        data: {
          hasCheckedIn: false,
          dateInfo,
          userInfo: userInfo[0],
          checkInRecords: [],
          primaryCheckIn: null,
          totalRecords: 0
        },
        message: `${date} 无打卡记录`
      });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义获取前五十用户排行榜接口，处理GET请求
app.get('/users/ranking/top50', async (req, res) => {
  try {
    // 查询前50名用户，按打卡次数倒序排序
    const [users] = await pool.query(
      `SELECT 
        id,
        nickname, 
        checkInCount,
        created_at
       FROM users 
       WHERE checkInCount > 0
       ORDER BY checkInCount DESC, created_at ASC
       LIMIT 50`
    );

    // 为每个用户添加排名信息
    const rankedUsers = users.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      nickname: user.nickname,
      checkInCount: user.checkInCount,
      joinDate: user.created_at,
      // 添加排名等级标识
      rankLevel: getRankLevel(index + 1),
      // 添加排名变化趋势（这里可以后续扩展）
      trend: 'stable' // stable, up, down
    }));

    // 统计信息
    const [totalStats] = await pool.query(
      'SELECT COUNT(*) as totalUsers, MAX(checkInCount) as maxCheckIn, AVG(checkInCount) as avgCheckIn FROM users WHERE checkInCount > 0'
    );

    // 获取今日打卡活跃用户数
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const [todayActive] = await pool.query(
      'SELECT COUNT(DISTINCT userId) as todayActiveUsers FROM checks WHERE date BETWEEN ? AND ?',
      [todayStart, todayEnd]
    );

    res.status(200).json({
      code: 200,
      data: {
        rankings: rankedUsers,
        statistics: {
          totalRankedUsers: users.length,
          totalActiveUsers: totalStats[0].totalUsers,
          maxCheckInCount: totalStats[0].maxCheckIn,
          averageCheckInCount: Math.round(totalStats[0].avgCheckIn * 100) / 100,
          todayActiveUsers: todayActive[0].todayActiveUsers,
          lastUpdateTime: new Date().toISOString()
        },
        rankingInfo: {
          displayCount: users.length,
          maxRank: 50,
          updateFrequency: '实时更新'
        }
      },
      message: '获取用户排行榜成功'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 辅助函数：获取排名等级
function getRankLevel(rank) {
  if (rank === 1) return { level: 'champion', name: '冠军', icon: '👑' };
  if (rank === 2) return { level: 'second', name: '亚军', icon: '🥈' };
  if (rank === 3) return { level: 'third', name: '季军', icon: '🥉' };
  if (rank <= 10) return { level: 'top10', name: '前十强', icon: '🏆' };
  if (rank <= 20) return { level: 'top20', name: '前二十', icon: '🏅' };
  if (rank <= 50) return { level: 'top50', name: '前五十', icon: '⭐' };
  return { level: 'normal', name: '普通', icon: '👤' };
}

// 定义查询指定用户当前排名接口，处理GET请求
app.get('/users/:userId/ranking', async (req, res) => {
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

    const currentUser = users[0];

    // 查询用户当前排名（比该用户打卡次数多的用户数量 + 1）
    const [rankResult] = await pool.query(
      `SELECT COUNT(*) + 1 as currentRank 
       FROM users 
       WHERE checkInCount > ? 
         OR (checkInCount = ? AND created_at < ?)`,
      [currentUser.checkInCount, currentUser.checkInCount, currentUser.created_at]
    );

    const currentRank = rankResult[0].currentRank;

    // 查询总用户数（有打卡记录的）
    const [totalResult] = await pool.query(
      'SELECT COUNT(*) as totalUsers FROM users WHERE checkInCount > 0'
    );
    const totalUsers = totalResult[0].totalUsers;

    // 查询前一名用户信息
    const [prevUser] = await pool.query(
      `SELECT nickname, checkInCount 
       FROM users 
       WHERE checkInCount > ? 
          OR (checkInCount = ? AND created_at < ?)
       ORDER BY checkInCount DESC, created_at ASC
       LIMIT 1`,
      [currentUser.checkInCount, currentUser.checkInCount, currentUser.created_at]
    );

    // 查询后一名用户信息
    const [nextUser] = await pool.query(
      `SELECT nickname, checkInCount 
       FROM users 
       WHERE checkInCount < ? 
          OR (checkInCount = ? AND created_at > ?)
       ORDER BY checkInCount DESC, created_at ASC
       LIMIT 1`,
      [currentUser.checkInCount, currentUser.checkInCount, currentUser.created_at]
    );

    // 查询用户周围排名（前后各5名）
    const [nearbyUsers] = await pool.query(
      `(
        SELECT id, nickname, checkInCount, created_at,
        @rank := @rank + 1 as rank
        FROM users, (SELECT @rank := 0) r
        WHERE checkInCount > ? 
           OR (checkInCount = ? AND created_at < ?)
        ORDER BY checkInCount DESC, created_at ASC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT id, nickname, checkInCount, created_at, ? as rank
        FROM users 
        WHERE id = ?
      )
      UNION ALL
      (
        SELECT id, nickname, checkInCount, created_at,
        @rank2 := @rank2 + ? + 1 as rank
        FROM users, (SELECT @rank2 := 0) r2
        WHERE checkInCount < ? 
           OR (checkInCount = ? AND created_at > ?)
        ORDER BY checkInCount DESC, created_at ASC
        LIMIT 5
      )
      ORDER BY rank`,
      [
        currentUser.checkInCount, currentUser.checkInCount, currentUser.created_at,
        currentRank,
        userId,
        currentRank, 
        currentUser.checkInCount, currentUser.checkInCount, currentUser.created_at
      ]
    );

    // 计算百分位数
    const percentile = totalUsers > 0 ? Math.round(((totalUsers - currentRank + 1) / totalUsers) * 100) : 0;

    // 查询本周打卡次数
    const now = new Date();
    const currentDay = now.getDay();
    const daysToThisWeekStart = currentDay === 0 ? 6 : currentDay - 1;
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToThisWeekStart);
    weekStart.setHours(0, 0, 0, 0);
    
    const [weeklyChecks] = await pool.query(
      'SELECT COUNT(*) as weeklyCount FROM checks WHERE userId = ? AND date >= ? AND status = "completed"',
      [userId, weekStart]
    );

    // 查询本月打卡次数
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [monthlyChecks] = await pool.query(
      'SELECT COUNT(*) as monthlyCount FROM checks WHERE userId = ? AND date >= ? AND status = "completed"',
      [userId, monthStart]
    );

    // 查询连续打卡天数
    const [consecutiveDays] = await pool.query(`
      SELECT COUNT(*) as consecutive_days
      FROM (
        SELECT DATE(date) as check_date
        FROM checks 
        WHERE userId = ? AND status = 'completed'
        GROUP BY DATE(date)
        HAVING check_date >= (
          SELECT MIN(missing_date) 
          FROM (
            SELECT DATE_SUB(CURDATE(), INTERVAL seq DAY) as missing_date
            FROM (
              SELECT 0 as seq UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
              UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
              UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
              UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
              UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
              UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29
            ) seq_table
            WHERE DATE_SUB(CURDATE(), INTERVAL seq DAY) NOT IN (
              SELECT DATE(date) FROM checks WHERE userId = ? AND status = 'completed'
            )
          ) missing
        )
      ) recent_checks
    `, [userId, userId]);

    res.status(200).json({
      code: 200,
      data: {
        userInfo: {
          id: currentUser.id,
          nickname: currentUser.nickname,
          checkInCount: currentUser.checkInCount,
          joinDate: currentUser.created_at
        },
        rankingInfo: {
          currentRank,
          totalUsers,
          percentile,
          rankLevel: getRankLevel(currentRank),
          gapToNext: prevUser.length > 0 ? prevUser[0].checkInCount - currentUser.checkInCount : 0,
          gapToPrevious: nextUser.length > 0 ? currentUser.checkInCount - nextUser[0].checkInCount : 0
        },
        adjacentUsers: {
          previous: prevUser.length > 0 ? {
            rank: currentRank - 1,
            nickname: prevUser[0].nickname,
            checkInCount: prevUser[0].checkInCount
          } : null,
          next: nextUser.length > 0 ? {
            rank: currentRank + 1,
            nickname: nextUser[0].nickname,
            checkInCount: nextUser[0].checkInCount
          } : null
        },
        nearbyRankings: nearbyUsers.map(user => ({
          rank: parseInt(user.rank),
          id: user.id,
          nickname: user.nickname,
          checkInCount: user.checkInCount,
          isCurrentUser: user.id === parseInt(userId)
        })),
        statistics: {
          thisWeekChecks: weeklyChecks[0].weeklyCount,
          thisMonthChecks: monthlyChecks[0].monthlyCount,
          consecutiveDays: consecutiveDays[0].consecutive_days || 0
        },
        achievements: generateAchievements(currentUser.checkInCount, currentRank, percentile)
      },
      message: '获取用户排名信息成功'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 辅助函数：生成成就信息
function generateAchievements(checkInCount, rank, percentile) {
  const achievements = [];
  
  // 基于打卡次数的成就
  if (checkInCount >= 100) achievements.push({ name: '百日坚持', icon: '💯', description: '累计打卡100天' });
  if (checkInCount >= 50) achievements.push({ name: '五十里程碑', icon: '🎖️', description: '累计打卡50天' });
  if (checkInCount >= 30) achievements.push({ name: '月度达人', icon: '📅', description: '累计打卡30天' });
  
  // 基于排名的成就
  if (rank === 1) achievements.push({ name: '排行榜冠军', icon: '👑', description: '当前排名第一' });
  if (rank <= 3) achievements.push({ name: '前三甲', icon: '🏆', description: '进入前三名' });
  if (rank <= 10) achievements.push({ name: '十强选手', icon: '🏅', description: '进入前十名' });
  
  // 基于百分位的成就
  if (percentile >= 90) achievements.push({ name: '顶尖玩家', icon: '⭐', description: '超越90%的用户' });
  if (percentile >= 75) achievements.push({ name: '优秀表现', icon: '✨', description: '超越75%的用户' });
  
  return achievements;
}

// 定义获取前五十群组排行榜接口，处理GET请求
app.get('/groups/ranking/top50', async (req, res) => {
  try {
    // 查询前50个群组，按打卡次数倒序排序
    const [groups] = await pool.query(
      `SELECT g.*, 
       GROUP_CONCAT(u.nickname) as memberNicknames,
       COUNT(gm.userId) as memberCount,
       ROUND(g.checkInCount / COUNT(gm.userId), 2) as avgCheckInPerMember
       FROM \`groups\` g
       LEFT JOIN group_members gm ON g.id = gm.groupId
       LEFT JOIN users u ON gm.userId = u.id
       WHERE g.checkInCount > 0
       GROUP BY g.id
       ORDER BY g.checkInCount DESC, g.created_at ASC
       LIMIT 50`
    );

    // 为每个群组添加排名信息
    const rankedGroups = groups.map((group, index) => ({
      rank: index + 1,
      id: group.id,
      name: group.name,
      creatorId: group.creatorId,
      checkInCount: group.checkInCount,
      memberCount: group.memberCount,
      avgCheckInPerMember: group.avgCheckInPerMember,
      members: group.memberNicknames ? group.memberNicknames.split(',').slice(0, 5) : [], // 只显示前5个成员
      createdAt: group.created_at,
      rankLevel: getGroupRankLevel(index + 1),
      efficiency: group.memberCount > 0 ? Math.round((group.checkInCount / group.memberCount) * 100) / 100 : 0
    }));

    // 统计信息
    const [totalStats] = await pool.query(
      'SELECT COUNT(*) as totalGroups, MAX(checkInCount) as maxCheckIn, AVG(checkInCount) as avgCheckIn FROM `groups` WHERE checkInCount > 0'
    );

    res.status(200).json({
      code: 200,
      data: {
        rankings: rankedGroups,
        statistics: {
          totalRankedGroups: groups.length,
          totalActiveGroups: totalStats[0].totalGroups,
          maxCheckInCount: totalStats[0].maxCheckIn,
          averageCheckInCount: Math.round(totalStats[0].avgCheckIn * 100) / 100,
          lastUpdateTime: new Date().toISOString()
        },
        rankingInfo: {
          displayCount: groups.length,
          maxRank: 50,
          updateFrequency: '实时更新'
        }
      },
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

// 辅助函数：获取群组排名等级
function getGroupRankLevel(rank) {
  if (rank === 1) return { level: 'champion', name: '冠军群组', icon: '👑' };
  if (rank === 2) return { level: 'second', name: '亚军群组', icon: '🥈' };
  if (rank === 3) return { level: 'third', name: '季军群组', icon: '🥉' };
  if (rank <= 10) return { level: 'top10', name: '十强群组', icon: '🏆' };
  if (rank <= 20) return { level: 'top20', name: '二十强', icon: '🏅' };
  if (rank <= 50) return { level: 'top50', name: '五十强', icon: '⭐' };
  return { level: 'normal', name: '普通', icon: '👥' };
}

// 定义获取综合排行榜信息接口，处理GET请求
app.get('/ranking/overview', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 10, 50);

    // 并行查询用户和群组排行榜
    const [userRankings, groupRankings] = await Promise.all([
      pool.query(
        `SELECT id, nickname, checkInCount, created_at
         FROM users 
         WHERE checkInCount > 0
         ORDER BY checkInCount DESC, created_at ASC
         LIMIT ?`,
        [limitNum]
      ),
      pool.query(
        `SELECT g.id, g.name, g.checkInCount, g.created_at, COUNT(gm.userId) as memberCount
         FROM \`groups\` g
         LEFT JOIN group_members gm ON g.id = gm.groupId
         WHERE g.checkInCount > 0
         GROUP BY g.id
         ORDER BY g.checkInCount DESC, g.created_at ASC
         LIMIT ?`,
        [limitNum]
      )
    ]);

    // 获取今日活跃统计
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todayStats] = await pool.query(
      'SELECT COUNT(DISTINCT userId) as activeUsers, COUNT(*) as totalChecks FROM checks WHERE date BETWEEN ? AND ?',
      [todayStart, todayEnd]
    );

    res.status(200).json({
      code: 200,
      data: {
        userRankings: userRankings[0].map((user, index) => ({
          rank: index + 1,
          id: user.id,
          nickname: user.nickname,
          checkInCount: user.checkInCount,
          rankLevel: getRankLevel(index + 1)
        })),
        groupRankings: groupRankings[0].map((group, index) => ({
          rank: index + 1,
          id: group.id,
          name: group.name,
          checkInCount: group.checkInCount,
          memberCount: group.memberCount,
          rankLevel: getGroupRankLevel(index + 1)
        })),
        todayStatistics: {
          activeUsers: todayStats[0].activeUsers,
          totalTodayChecks: todayStats[0].totalChecks,
          date: new Date().toISOString().split('T')[0]
        },
        lastUpdateTime: new Date().toISOString()
      },
      message: '获取综合排行榜成功'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});

// 定义快速检查今日打卡状态接口（轻量级），处理GET请求
app.get('/checks/:userId/today/status', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 获取今天的开始和结束时间
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 只查询今天是否有打卡记录，不返回详细信息
    const [checks] = await pool.query(
      'SELECT COUNT(*) as count FROM checks WHERE userId = ? AND date BETWEEN ? AND ?',
      [userId, todayStart, todayEnd]
    );

    const hasCheckedIn = checks[0].count > 0;
    const today = new Date().toISOString().split('T')[0];

    res.status(200).json({
      code: 200,
      data: {
        userId: parseInt(userId),
        date: today,
        hasCheckedIn,
        checkCount: checks[0].count
      },
      message: hasCheckedIn ? '今日已打卡' : '今日未打卡'
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
    console.log('groupList')
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