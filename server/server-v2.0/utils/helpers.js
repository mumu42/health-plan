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
  
  module.exports = {
    getRankLevel,
    getGroupRankLevel,
    generateAchievements
  };