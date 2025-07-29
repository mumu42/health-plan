const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// 修改打卡接口
// 修改打卡接口，支持新的字段
router.post('/checkin', async (req, res) => {
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
  router.get('/checks/:userId', async (req, res) => {
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
  

// 定义获取用户上周签到数据接口，处理GET请求
router.get('/checks/:userId/lastweek', async (req, res) => {
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
  router.get('/checks/:userId/week', async (req, res) => {
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
  router.get('/checks/:userId/today', async (req, res) => {
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
  router.get('/checks/:userId/date/:date', async (req, res) => {
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

// 定义快速检查今日打卡状态接口（轻量级），处理GET请求
router.get('/checks/:userId/today/status', async (req, res) => {
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

module.exports = router;