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

// 用户模型Schema
const userSchema = new mongoose.Schema({
  nickname: String,
  password: String,
  checkInCount: { type: Number, default: 0 } // 新增：用户打卡次数
});
// 创建User模型，并指定集合名称为'user'
const User = mongoose.model('User', userSchema, 'user');

// 定义打卡记录模型Schema
const checkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // 关联用户ID
  date: { type: Date, default: Date.now },  // 打卡日期，默认为当前时间
  status: { type: String, enum: ['completed', 'skipped'] },  // 打卡状态
  notes: String  // 打卡备注
});
// 创建Check模型，并指定集合名称为'check'
const Check = mongoose.model('Check', checkSchema, 'check');

// 定义群组模型Schema
const groupSchema = new mongoose.Schema({
  name: String,
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nickname: String,
    checkInCount: Number
  }],
  createdAt: { type: Date, default: Date.now },
  checkInCount: { type: Number, default: 0 } // 新增：群组打卡次数
});
// 创建Group模型，并指定集合名称为'group'
const Group = mongoose.model('Group', groupSchema, 'group');

// 定义登录接口，处理POST请求
app.post('/login', async (req, res) => {
  try {
    // 从请求体中获取昵称和密码
    const { nickname, password } = req.body;
    // 在数据库中查找匹配的用户
    const user = await User.findOne({ nickname, password });
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
          const saveUser = await newUser.save();

          res.status(200).json({
            code: 200,
            data: { 
              id: saveUser._id,  // 用户ID
              nickname: saveUser.nickname  // 用户昵称
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


// 修改打卡接口
app.post('/checkin', async (req, res) => {
  try {
    const { userId, groupId, status, notes } = req.body;
    
    // 验证用户是否存在
    const user = await User.findById(userId);
    if (!user) {
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

    // 检查今天是否已经打卡
    const existingCheck = await Check.findOne({
      userId,
      date: { $gte: todayStart, $lte: todayEnd }
    });

    console.log('existingCheck=', existingCheck)

    if (existingCheck) {
      return res.status(400).json({
        code: 400,
        message: '今天已经打卡过了',
        data: {
          checkId: existingCheck._id,
          status: existingCheck.status
        }
      });
    }

    // 创建打卡记录
    const newCheck = new Check({
      userId,
      groupId,
      status,
      notes
    });
    const saveData = await newCheck.save();

    // 根据打卡状态决定累加值
    const incrementValue = status === 'completed' ? 1 : 0;
    
    // 更新用户打卡次数
    await User.findByIdAndUpdate(userId, { $inc: { checkInCount: incrementValue } });
    
    // 更新群组打卡次数
    groupId && await Group.findByIdAndUpdate(groupId, { $inc: { checkInCount: incrementValue } });

    const groupCheckInCount = groupId ? (await Group.findById(groupId)).checkInCount : ''

    const userCheckInCount = (await User.findById(userId)).checkInCount
    res.status(200).json({
      code: 200,
      data: {
        checkId: saveData._id,
        userId: saveData.userId,
        groupId: saveData.groupId,
        date: saveData.date,
        status: saveData.status,
        userCheckInCount,
        groupCheckInCount
      },
      message: '打卡成功'
    });
  } catch (error) {
    console.log('error=', error)
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
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    // 查询该用户的所有打卡记录，按日期降序排列
    const checks = await Check.find({ userId })
      .sort({ date: -1 })
      .exec();

    res.status(200).json({
      code: 200,
      data: checks.map(check => ({
        id: check._id,
        date: check.date,
        status: check.status,
        notes: check.notes
      })),
      message: '获取打卡记录成功'
    });
  } catch (error) {
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
    const creator = await User.findById(creatorId);
    if (!creator) {
      return res.status(404).json({
        code: 404,
        message: '创建者不存在'
      });
    }

    // 验证群组名称是否已存在
    const existingGroup = await Group.findOne({ name });
    if (existingGroup) {
      return res.status(400).json({
        code: 400,
        message: '群组名称已存在'
      });
    }

    // 验证所有成员是否存在
    const allMemberIds = [...memberIds];
    const members = await User.find({ _id: { $in: allMemberIds } });
    if (members.length !== allMemberIds.length) {
      return res.status(404).json({
        code: 404,
        message: '部分成员不存在'
      });
    }

    // 处理成员信息，排除密码
    const formattedMembers = members.map(user => ({
      _id: user._id,
      nickname: user.nickname,
      checkInCount: user.checkInCount
    }));

    // 创建新群组
    const newGroup = new Group({
      name,
      creator: creatorId,
      members: formattedMembers
    });

    // 保存群组到数据库
    await newGroup.save();

    res.status(200).json({
      code: 200,
      data: {
        id: newGroup._id,
        name: newGroup.name,
        creator: newGroup.creator,
        members: newGroup.members,
        createdAt: newGroup.createdAt
      },
      message: '群组创建成功'
    });
  } catch (error) {
    console.log('error=', error)
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
    const creator = await User.findById(creatorId);
    if (!creator) {
      return res.status(404).json({
        code: 404,
        message: '创建者不存在'
      });
    }

    // 查询该创建者的所有群组，按创建时间降序排列
    const groups = await Group.find({ creator: creatorId })
      .sort({ createdAt: -1 })
      .exec();

    res.status(200).json({
      code: 200,
      data: groups.map(group => ({
        id: group._id,
        name: group.name,
        creator: group.creator,
        members: group.members,
        createdAt: group.createdAt
      })),
      message: '获取群组列表成功'
    });
  } catch (error) {
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
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        code: 404,
        message: '群组不存在'
      });
    }

    // 验证当前请求者是否为群主
    if (!group.creator.equals(currentOwnerId)) {
      return res.status(403).json({
        code: 403,
        message: '只有群主可以转让群组所有权'
      });
    }

    // 验证新群主是否为群组成员
    const newOwnerIndex = group.members.findIndex(member => member._id.equals(newOwnerId));
    if (newOwnerIndex === -1) {
      return res.status(404).json({
        code: 404,
        message: '指定的新群主不是群组成员'
      });
    }

    // 转让群主权限
    group.creator = newOwnerId;
    await group.save();

    res.status(200).json({
      code: 200,
      message: '群主转让成功',
      data: {
        groupId: group._id,
        newCreator: group.creator
      }
    });
  } catch (error) {
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
    const groups = await Group.find({
      'members._id': memberId
    });

    res.status(200).json({
      code: 200,
      data: groups.map(group => ({
        id: group._id,
        name: group.name,
        creator: group.creator,
        members: group.members,
        createdAt: group.createdAt
      })),
      message: '获取成员所在组成功'
    });
  } catch (error) {
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

    // 使用正则表达式进行模糊搜索
    const groups = await Group.find({ 
      name: { $regex: name, $options: 'i' } 
    })
    .sort({ createdAt: -1 })
    .exec();

    res.status(200).json({
      code: 200,
      data: groups.map(group => ({
        id: group._id,
        name: group.name,
        creator: group.creator,
        memberCount: group.members.length,
        createdAt: group.createdAt
      })),
      message: '搜索成功'
    });
  } catch (error) {
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
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    // 验证群组是否存在
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        code: 404,
        message: '群组不存在'
      });
    }

    // 检查用户是否已在群组中
    const existingMemberIndex = group.members.findIndex(member => member._id.equals(userId));
    if (existingMemberIndex !== -1) {
      return res.status(400).json({
        code: 400,
        message: '用户已在群组中'
      });
    }

    // 添加用户到群组成员列表
    group.members.push({
      _id: user._id,
      nickname: user.nickname,
      checkInCount: user.checkInCount
    });
    await group.save();

    res.status(200).json({
      code: 200,
      data: {
        groupId: group._id,
        name: group.name,
        members: group.members
      },
      message: '加入群组成功'
    });
  } catch (error) {
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
    const users = await User.find({})
      .sort({ checkInCount: -1 })
      .select('nickname checkInCount') // 只返回昵称和打卡次数
      .exec();

    res.status(200).json({
      code: 200,
      data: users.map(user => ({
        nickname: user.nickname,
        checkInCount: user.checkInCount
      })),
      message: '获取排行榜成功'
    });
  } catch (error) {
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
    const groups = await Group.find({})
      .sort({ checkInCount: -1 })
      .select('name checkInCount members') // 返回名称、打卡次数和成员数
      .populate('members', 'nickname') // 关联查询成员昵称
      .exec();
    res.status(200).json({
      code: 200,
      data: groups.map(group => ({
        name: group.name,
        checkInCount: group.members.map(i => i.checkInCount).reduce((acc, curr) => acc + curr, 0),
        memberCount: group.members.length,
        members: group.members.map(member => member.nickname) // 成员昵称列表
      })),
      message: '获取群组排行榜成功'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
});


// 定义根据群组id删除群组接口，处理DELETE请求
app.post('/deleteGroup', async (req, res) => {
  try {
    const { userId, groupId } = req.body;

    // 验证群组是否存在
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        code: 404,
        message: '群组不存在'
      });
    }

    // 验证请求者是否为群主
    if (!group.creator.equals(userId)) {
      return res.status(403).json({
        code: 403,
        message: '只有群主可以删除群组'
      });
    }

    // 删除群组
    await Group.findByIdAndDelete(groupId);

    res.status(200).json({
      code: 200,
      message: '群组删除成功'
    });
  } catch (error) {
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
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        code: 404,
        message: '群组不存在'
      });
    }

    // 验证请求者是否为群主
    if (!group.creator.equals(userId)) {
      return res.status(403).json({
        code: 403,
        message: '只有群主可以删除群组成员'
      });
    }

    // 检查要删除的成员是否存在于群组中
    const memberIndex = group.members.findIndex(member => member._id.equals(memberId));
    if (memberIndex === -1) {
      return res.status(404).json({
        code: 404,
        message: '群组成员不存在'
      });
    }

    // 检查要删除的成员是否是群主
    if (group.creator.equals(memberId)) {
      // 如果群组还有其他成员，将下一个成员设为新群主
      if (group.members.length > 1) {
        const newCreatorIndex = memberIndex === group.members.length - 1 ? 0 : memberIndex + 1;
        group.creator = group.members[newCreatorIndex]._id;
      } else {
        return res.status(400).json({
          code: 400,
          message: '群组中只有群主一名成员，无法删除'
        });
      }
    }

    // 删除群组成员
    group.members.splice(memberIndex, 1);
    await group.save();

    res.status(200).json({
      code: 200,
      message: '群组成员删除成功',
      data: {
        groupId: group._id,
        members: group.members,
        creator: group.creator
      }
    });
  } catch (error) {
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

    // 查询用户已加入的群组ID
    const joinedGroups = await Group.find({
      'members._id': userId
    }).select('_id');

    const joinedGroupIds = joinedGroups.map(group => group._id);

    // 查询用户未加入的所有群组
    const notJoinedGroups = await Group.find({
      _id: { $nin: joinedGroupIds }
    });

    res.status(200).json({
      code: 200,
      data: notJoinedGroups.map(group => ({
        id: group._id,
        name: group.name,
        creator: group.creator,
        members: group.members,
        createdAt: group.createdAt
      })),
      message: '获取用户未加入的群组成功'
    });
  } catch (error) {
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
    const groups = await Group.find({})
      .sort({ createdAt: -1 })
      .exec();

    res.status(200).json({
      code: 200,
      data: groups.map(group => ({
        id: group._id,
        name: group.name,
        creator: group.creator,
        members: group.members,
        createdAt: group.createdAt,
        checkInCount: group.checkInCount
      })),
      message: '获取所有群组成功'
    });
  } catch (error) {
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