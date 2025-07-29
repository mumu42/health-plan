const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// 定义创建群组接口，处理POST请求
router.post('/groups', async (req, res) => {
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
  router.get('/groups/creator/:creatorId', async (req, res) => {
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
  router.post('/groups/:groupId/transferOwner', async (req, res) => {
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
  router.get('/groups/member/:memberId', async (req, res) => {
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
  router.get('/groups/search', async (req, res) => {
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
  router.post('/groups/:groupId/join', async (req, res) => {
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

  // 定义根据群组成员ID删除群组成员接口，处理POST请求
router.post('/groups/:groupId/removeMember', async (req, res) => {
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
  router.get('/groups/not-joined/:userId', async (req, res) => {
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
  router.get('/groupList', async (req, res) => {
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

module.exports = router;
