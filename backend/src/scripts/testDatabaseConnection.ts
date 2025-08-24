#!/usr/bin/env node

/**
 * 简单的数据库连接测试脚本
 * 用于验证数据库连接重试机制是否正常工作
 */

import { connectDB, checkDatabaseHealth, getConnectionStatus } from '../config/mongodb';
import { logger } from '../config/logger';

async function testDatabaseConnection() {
  console.log('🚀 开始数据库连接测试...');
  
  try {
    // 1. 获取初始连接状态
    console.log('\n📊 获取初始连接状态:');
    const initialStatus = getConnectionStatus();
    console.log('连接状态:', initialStatus.state);
    console.log('重连尝试次数:', initialStatus.reconnectAttempts);
    console.log('是否正在连接:', initialStatus.isConnecting);
    
    // 2. 检查数据库健康状态
    console.log('\n🏥 检查数据库健康状态:');
    const healthBefore = await checkDatabaseHealth();
    console.log('健康状态:', healthBefore.healthy ? '健康' : '不健康');
    console.log('详细信息:', healthBefore.details);
    
    // 3. 尝试连接数据库
    console.log('\n🔌 尝试连接数据库...');
    await connectDB();
    console.log('✅ 数据库连接成功');
    
    // 4. 再次检查连接状态
    console.log('\n📊 连接后状态:');
    const statusAfter = getConnectionStatus();
    console.log('连接状态:', statusAfter.state);
    console.log('主机:', statusAfter.host || 'N/A');
    console.log('端口:', statusAfter.port || 'N/A');
    console.log('数据库名:', statusAfter.name || 'N/A');
    
    // 5. 再次检查健康状态
    console.log('\n🏥 连接后健康状态:');
    const healthAfter = await checkDatabaseHealth();
    console.log('健康状态:', healthAfter.healthy ? '健康' : '不健康');
    console.log('详细信息:', healthAfter.details);
    
    console.log('\n🎉 数据库连接测试完成！');
    
  } catch (error) {
    console.error('\n❌ 数据库连接测试失败:', error);
    process.exit(1);
  }
}

// 处理进程退出信号
process.on('SIGINT', () => {
  console.log('\n⚠️  收到中断信号，正在退出...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  收到终止信号，正在退出...');
  process.exit(0);
});

// 运行测试
if (require.main === module) {
  testDatabaseConnection().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}