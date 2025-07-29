const express = require('express');
const { pool } = require('../config/database');
const { getRankLevel, generateAchievements } = require('../utils/helpers');
const router = express.Router();

// 定义获取用户排行榜接口，按打卡次数倒序排序
router.get('/users/ranking', async (req, res) => {
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

// 定义获取前五十用户排行榜接口，处理GET请求
router.get('/users/ranking/top50', async (req, res) => {
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

// 定义获取群组排行榜接口，按打卡次数倒序排序
router.get('/groups/ranking', async (req, res) => {
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

// 定义获取综合排行榜信息接口，处理GET请求
router.get('/ranking/overview', async (req, res) => {
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

// 定义获取前五十群组排行榜接口，处理GET请求
router.get('/groups/ranking/top50', async (req, res) => {
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

// 定义获取用户排行榜接口，按打卡次数倒序排序
router.get('/users/ranking', async (req, res) => {
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

module.exports = router;
