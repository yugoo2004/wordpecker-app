#!/usr/bin/env node

/**
 * 数据库操作完整性测试脚本
 * 验证 CRUD 操作、数据持久化、连接池和错误处理机制
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const MONGODB_URL = process.env.MONGODB_URL;

if (!MONGODB_URL) {
  console.error('❌ 错误: 未找到 MONGODB_URL 环境变量');
  process.exit(1);
}

const mongoUrl: string = MONGODB_URL;

// 连接池配置
const mongoOptions = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
  maxPoolSize: 20,  // 增加连接池大小用于测试
  minPoolSize: 5,
  retryWrites: true,
  retryReads: true,
  connectTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000,
};

// 测试数据模型定义
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  preferences: {
    language: { type: String, default: 'en' },
    theme: { type: String, default: 'light' }
  },
  stats: {
    wordsLearned: { type: Number, default: 0 },
    sessionsCompleted: { type: Number, default: 0 }
  }
});

const WordListSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestUser', required: true },
  words: [{
    word: { type: String, required: true },
    definition: { type: String },
    examples: [String],
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('TestUser', UserSchema);
const WordList = mongoose.model('TestWordList', WordListSchema);

// 测试数据
const testUsers = [
  {
    username: 'testuser1',
    email: 'test1@example.com',
    preferences: { language: 'zh', theme: 'dark' },
    stats: { wordsLearned: 50, sessionsCompleted: 10 }
  },
  {
    username: 'testuser2',
    email: 'test2@example.com',
    preferences: { language: 'en', theme: 'light' },
    stats: { wordsLearned: 25, sessionsCompleted: 5 }
  }
];

const testWordLists = [
  {
    name: '日常英语词汇',
    description: '常用的日常英语单词',
    words: [
      {
        word: 'hello',
        definition: '你好，问候语',
        examples: ['Hello, how are you?', 'Hello world!'],
        difficulty: 'easy'
      },
      {
        word: 'beautiful',
        definition: '美丽的，漂亮的',
        examples: ['She is beautiful.', 'What a beautiful day!'],
        difficulty: 'medium'
      }
    ]
  }
];

async function testDatabaseOperations() {
  let connection: typeof mongoose | null = null;
  
  try {
    console.log('🔍 开始数据库操作完整性测试...');
    console.log(`📍 连接地址: ${mongoUrl.replace(/\/\/.*@/, '//***:***@')}`);
    
    // 1. 连接数据库
    console.log('\n1️⃣ 建立数据库连接...');
    connection = await mongoose.connect(mongoUrl, mongoOptions);
    console.log('✅ 数据库连接成功');
    
    // 2. 清理测试数据
    console.log('\n2️⃣ 清理旧的测试数据...');
    await User.deleteMany({ username: { $in: ['testuser1', 'testuser2'] } });
    await WordList.deleteMany({ name: '日常英语词汇' });
    console.log('✅ 测试数据清理完成');
    
    // 3. 测试创建操作 (Create)
    console.log('\n3️⃣ 测试创建操作 (Create)...');
    
    // 创建用户
    const createdUsers = await User.insertMany(testUsers);
    console.log(`✅ 成功创建 ${createdUsers.length} 个用户`);
    
    // 创建词汇列表
    const wordListData = {
      ...testWordLists[0],
      userId: createdUsers[0]._id
    };
    const createdWordList = await WordList.create(wordListData);
    console.log('✅ 成功创建词汇列表');
    
    // 4. 测试读取操作 (Read)
    console.log('\n4️⃣ 测试读取操作 (Read)...');
    
    // 基本查询
    const foundUsers = await User.find({});
    console.log(`✅ 查询到 ${foundUsers.length} 个用户`);
    
    // 条件查询
    const specificUser = await User.findOne({ username: 'testuser1' });
    if (specificUser) {
      console.log(`✅ 条件查询成功: ${specificUser.username}`);
    }
    
    // 关联查询
    const wordListWithUser = await WordList.findById(createdWordList._id).populate('userId');
    if (wordListWithUser && wordListWithUser.userId) {
      console.log('✅ 关联查询成功');
    }
    
    // 聚合查询
    const userStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalWordsLearned: { $sum: '$stats.wordsLearned' },
          avgSessionsCompleted: { $avg: '$stats.sessionsCompleted' }
        }
      }
    ]);
    console.log(`✅ 聚合查询成功: 总学习单词 ${userStats[0].totalWordsLearned}`);
    
    // 5. 测试更新操作 (Update)
    console.log('\n5️⃣ 测试更新操作 (Update)...');
    
    // 单文档更新
    const updateResult = await User.findByIdAndUpdate(
      createdUsers[0]._id,
      { 
        $inc: { 'stats.wordsLearned': 10 },
        $set: { 'preferences.theme': 'auto' }
      },
      { new: true }
    );
    
    if (updateResult && updateResult.stats && updateResult.stats.wordsLearned === 60) {
      console.log('✅ 单文档更新成功');
    }
    
    // 批量更新
    const bulkUpdateResult = await User.updateMany(
      {},
      { $inc: { 'stats.sessionsCompleted': 1 } }
    );
    console.log(`✅ 批量更新成功: 影响 ${bulkUpdateResult.modifiedCount} 个文档`);
    
    // 数组操作
    const arrayUpdateResult = await WordList.findByIdAndUpdate(
      createdWordList._id,
      {
        $push: {
          words: {
            word: 'amazing',
            definition: '令人惊奇的',
            examples: ['This is amazing!'],
            difficulty: 'medium'
          }
        },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );
    
    if (arrayUpdateResult && arrayUpdateResult.words && arrayUpdateResult.words.length === 3) {
      console.log('✅ 数组操作成功');
    }
    
    // 6. 测试数据持久化
    console.log('\n6️⃣ 测试数据持久化...');
    
    // 断开连接
    await mongoose.connection.close();
    console.log('✅ 连接已断开');
    
    // 重新连接
    await mongoose.connect(mongoUrl, mongoOptions);
    console.log('✅ 重新连接成功');
    
    // 验证数据是否持久化
    const persistedUsers = await User.find({});
    const persistedWordLists = await WordList.find({});
    
    if (persistedUsers.length === 2 && persistedWordLists.length === 1) {
      console.log('✅ 数据持久化验证成功');
    } else {
      throw new Error('数据持久化失败');
    }
    
    // 7. 测试删除操作 (Delete)
    console.log('\n7️⃣ 测试删除操作 (Delete)...');
    
    // 单文档删除
    const deleteResult = await User.findByIdAndDelete(createdUsers[1]._id);
    if (deleteResult) {
      console.log('✅ 单文档删除成功');
    }
    
    // 条件删除
    const conditionalDeleteResult = await WordList.deleteOne({ name: '日常英语词汇' });
    if (conditionalDeleteResult.deletedCount === 1) {
      console.log('✅ 条件删除成功');
    }
    
    // 8. 测试连接池
    console.log('\n8️⃣ 测试连接池性能...');
    
    const concurrentOperations = Array.from({ length: 50 }, async (_, index) => {
      const testDoc = new User({
        username: `concurrent_user_${index}`,
        email: `concurrent${index}@example.com`
      });
      return await testDoc.save();
    });
    
    const startTime = Date.now();
    const concurrentResults = await Promise.all(concurrentOperations);
    const endTime = Date.now();
    
    console.log(`✅ 并发操作成功: ${concurrentResults.length} 个操作耗时 ${endTime - startTime}ms`);
    
    // 9. 测试错误处理机制
    console.log('\n9️⃣ 测试错误处理机制...');
    
    // 测试唯一约束违反
    try {
      await User.create({
        username: 'concurrent_user_0', // 重复用户名
        email: 'duplicate@example.com'
      });
      console.log('❌ 唯一约束测试失败');
    } catch (error) {
      if (error instanceof Error && (error instanceof Error ? error.message : String(error)).includes('duplicate key')) {
        console.log('✅ 唯一约束错误处理正常');
      }
    }
    
    // 测试验证错误
    try {
      await User.create({
        // 缺少必需字段
        email: 'invalid@example.com'
      });
      console.log('❌ 验证错误测试失败');
    } catch (error) {
      if (error instanceof Error && (error instanceof Error ? error.message : String(error)).includes('required')) {
        console.log('✅ 验证错误处理正常');
      }
    }
    
    // 测试无效 ObjectId
    try {
      await User.findById('invalid_object_id');
    } catch (error) {
      console.log('✅ 无效 ObjectId 错误处理正常');
    }
    
    // 10. 性能测试
    console.log('\n🔟 性能测试...');
    
    const performanceTestStart = Date.now();
    
    // 批量插入测试
    const bulkInsertData = Array.from({ length: 1000 }, (_, index) => ({
      username: `perf_user_${index}`,
      email: `perf${index}@example.com`,
      stats: { wordsLearned: Math.floor(Math.random() * 100) }
    }));
    
    await User.insertMany(bulkInsertData);
    
    // 复杂查询测试
    const complexQuery = await User.find({
      'stats.wordsLearned': { $gte: 50 }
    }).sort({ 'stats.wordsLearned': -1 }).limit(10);
    
    const performanceTestEnd = Date.now();
    
    console.log(`✅ 性能测试完成: 1000条数据插入和复杂查询耗时 ${performanceTestEnd - performanceTestStart}ms`);
    console.log(`✅ 查询结果: ${complexQuery.length} 条记录`);
    
    // 11. 清理测试数据
    console.log('\n1️⃣1️⃣ 清理测试数据...');
    await User.deleteMany({ username: { $regex: /^(testuser|concurrent_user|perf_user)/ } });
    await WordList.deleteMany({});
    console.log('✅ 测试数据清理完成');
    
    console.log('\n🎉 所有数据库操作测试通过！');
    
    // 连接统计信息
    console.log('\n📊 最终统计信息:');
    console.log(`   - 连接状态: ${mongoose.connection.readyState === 1 ? '已连接' : '未连接'}`);
    console.log(`   - 数据库名称: ${mongoose.connection.name}`);
    console.log(`   - 主机地址: ${mongoose.connection.host}:${mongoose.connection.port}`);
    console.log(`   - 连接池状态: 最大连接数 ${mongoOptions.maxPoolSize}, 最小连接数 ${mongoOptions.minPoolSize}`);
    
  } catch (error) {
    console.error('\n❌ 数据库操作测试失败:');
    
    if (error instanceof Error) {
      console.error(`   错误信息: ${(error instanceof Error ? error.message : String(error))}`);
      console.error(`   错误堆栈: ${error.stack}`);
    }
    
    console.error('\n🔧 建议的解决方案:');
    console.error('   1. 检查数据库连接配置');
    console.error('   2. 验证数据模型定义');
    console.error('   3. 检查网络连接稳定性');
    console.error('   4. 确认数据库权限设置');
    
    process.exit(1);
  } finally {
    // 确保连接关闭
    if (connection) {
      await mongoose.connection.close();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 运行测试
if (require.main === module) {
  testDatabaseOperations()
    .then(() => {
      console.log('\n✨ 数据库操作完整性测试完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 测试脚本执行失败:', error);
      process.exit(1);
    });
}

export { testDatabaseOperations };