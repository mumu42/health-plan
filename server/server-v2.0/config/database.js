const mysql = require('mysql2/promise');

// 创建MySQL连接池
const pool = mysql.createPool({
  host: 'localhost',
  user: 'yourname',
  password: 'yourpassword',
  database: 'yourbasename',
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

module.exports = {
  pool,
  initializeDatabase
};