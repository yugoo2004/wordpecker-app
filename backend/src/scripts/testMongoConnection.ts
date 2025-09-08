#!/usr/bin/env node

/**
 * MongoDB 连接测试脚本
 * 用于验证 Sealos 托管 MongoDB 数据库的连接性和基本功能
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// MongoDB 连接配置
const MONGODB_URL = process.env.MONGODB_URL;
const TEST_DB_NAME = 'wordpecker_test';

if (!MONGODB_URL) {
  console.error('❌ 错误: 未找到 MONGODB_URL 环境变量');
  process.exit(1);
}

// 确保 MONGODB_URL 不为 undefined
const mongoUrl: string = MONGODB_URL;

console.log('🔍 开始测试 Sealos 托管 MongoDB 连接...');
console.log(`📍 连接地址: ${MONGODB_URL.replace(/\/\/.*@/, '//***:***@')}`);

// MongoDB 连接选项
const mongoOptions = {
  serverSelectionTimeoutMS: 10000, // 10秒超时
  socketTimeoutMS: 45000,
  bufferCommands: false,
  maxPoolSize: 10,
  minPoolSize: 1,
  retryWrites: true,
  retryReads: true,
};

// 测试用的简单数据模型
const TestSchema = new mongoose.Schema({
  name: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  testData: { type: Object, default: {} }
});

const TestModel = mongoose.model('ConnectionTest', TestSchema);

async function testMongoConnection() {
  let connection: typeof mongoose | null = null;
  
  try {
    console.log('\n1️⃣ 测试数据库连接...');
    
    // 连接到 MongoDB
    connection = await mongoose.connect(mongoUrl, mongoOptions);
    console.log('✅ 数据库连接成功');
    
    // 获取连接信息
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('数据库连接失败');
    }
    const admin = db.admin();
    
    console.log('\n2️⃣ 验证数据库信息...');
    
    // 检查数据库状态
    const serverStatus = await admin.serverStatus();
    console.log(`✅ MongoDB 版本: ${serverStatus.version}`);
    console.log(`✅ 主机信息: ${serverStatus.host}`);
    console.log(`✅ 运行时间: ${Math.floor(serverStatus.uptime / 3600)} 小时`);
    
    // 列出数据库
    const databases = await admin.listDatabases();
    console.log(`✅ 可访问的数据库数量: ${databases.databases.length}`);
    
    console.log('\n3️⃣ 测试数据库操作权限...');
    
    // 测试创建操作 (Create)
    const testDoc = new TestModel({
      name: 'Sealos连接测试',
      testData: {
        timestamp: new Date().toISOString(),
        environment: 'sealos-devbox',
        testType: 'connection-validation'
      }
    });
    
    const savedDoc = await testDoc.save();
    console.log('✅ 创建操作成功 (Create)');
    
    // 测试读取操作 (Read)
    const foundDoc = await TestModel.findById(savedDoc._id);
    if (foundDoc) {
      console.log('✅ 读取操作成功 (Read)');
    } else {
      throw new Error('读取操作失败');
    }
    
    // 测试更新操作 (Update)
    const updatedDoc = await TestModel.findByIdAndUpdate(
      savedDoc._id,
      { $set: { 'testData.updated': true, 'testData.updateTime': new Date() } },
      { new: true }
    );
    
    if (updatedDoc && updatedDoc.testData.updated) {
      console.log('✅ 更新操作成功 (Update)');
    } else {
      throw new Error('更新操作失败');
    }
    
    // 测试删除操作 (Delete)
    const deleteResult = await TestModel.findByIdAndDelete(savedDoc._id);
    if (deleteResult) {
      console.log('✅ 删除操作成功 (Delete)');
    } else {
      throw new Error('删除操作失败');
    }
    
    console.log('\n4️⃣ 测试连接池和并发操作...');
    
    // 测试并发操作
    const concurrentOps = Array.from({ length: 5 }, async (_, index) => {
      const doc = new TestModel({
        name: `并发测试文档-${index}`,
        testData: { index, concurrent: true }
      });
      return await doc.save();
    });
    
    const concurrentResults = await Promise.all(concurrentOps);
    console.log(`✅ 并发操作成功，创建了 ${concurrentResults.length} 个文档`);
    
    // 清理测试数据
    await TestModel.deleteMany({ 'testData.concurrent': true });
    console.log('✅ 测试数据清理完成');
    
    console.log('\n5️⃣ 测试错误处理机制...');
    
    // 测试无效查询的错误处理
    try {
      await TestModel.findById('invalid_id');
    } catch (error) {
      console.log('✅ 错误处理机制正常工作');
    }
    
    console.log('\n🎉 所有测试通过！Sealos MongoDB 连接配置正确');
    console.log('\n📊 连接统计信息:');
    console.log(`   - 连接状态: ${mongoose.connection.readyState === 1 ? '已连接' : '未连接'}`);
    console.log(`   - 数据库名称: ${mongoose.connection.name}`);
    console.log(`   - 主机地址: ${mongoose.connection.host}:${mongoose.connection.port}`);
    
  } catch (error) {
    console.error('\n❌ MongoDB 连接测试失败:');
    
    if (error instanceof Error) {
      console.error(`   错误信息: ${(error instanceof Error ? error.message : String(error))}`);
      
      // 提供具体的错误诊断
      if ((error instanceof Error ? error.message : String(error)).includes('ENOTFOUND')) {
        console.error('   🔍 诊断: DNS 解析失败，请检查数据库主机地址');
      } else if ((error instanceof Error ? error.message : String(error)).includes('ECONNREFUSED')) {
        console.error('   🔍 诊断: 连接被拒绝，请检查数据库端口和网络连接');
      } else if ((error instanceof Error ? error.message : String(error)).includes('Authentication failed')) {
        console.error('   🔍 诊断: 认证失败，请检查用户名和密码');
      } else if ((error instanceof Error ? error.message : String(error)).includes('timeout')) {
        console.error('   🔍 诊断: 连接超时，请检查网络连接和防火墙设置');
      }
    }
    
    console.error('\n🔧 建议的解决方案:');
    console.error('   1. 检查 .env 文件中的 MONGODB_URL 配置');
    console.error('   2. 确认 Sealos MongoDB 服务正在运行');
    console.error('   3. 验证网络连接和 DNS 解析');
    console.error('   4. 检查数据库用户权限');
    
    process.exit(1);
  } finally {
    // 关闭数据库连接
    if (connection) {
      await mongoose.connection.close();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 运行测试
if (require.main === module) {
  testMongoConnection()
    .then(() => {
      console.log('\n✨ MongoDB 连接测试完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 测试脚本执行失败:', error);
      process.exit(1);
    });
}

export { testMongoConnection };