const express = require('express');
const { pool } = require('../config/database');
const { getRankLevel, generateAchievements } = require('../utils/helpers');
const router = express.Router();

// 定义查询指定用户当前排名接口，处理GET请求
router.get('/users/:userId/ranking', async (req, res) => {
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

module.exports = router;
