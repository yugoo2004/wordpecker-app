#!/usr/bin/env node

/**
 * 数据库连接和操作完整测试套件
 * 包含连接测试、CRUD操作、数据持久化、连接池和错误处理的全面验证
 */

import { testMongoConnection } from './testMongoConnection';
import { testDatabaseOperations } from './testDatabaseOperations';

async function runCompleteTests() {
  console.log('🚀 开始数据库完整测试套件...\n');
  
  try {
    console.log('=' .repeat(60));
    console.log('第一阶段: MongoDB 连接测试');
    console.log('=' .repeat(60));
    
    await testMongoConnection();
    
    console.log('\n' + '=' .repeat(60));
    console.log('第二阶段: 数据库操作完整性测试');
    console.log('=' .repeat(60));
    
    await testDatabaseOperations();
    
    console.log('\n' + '🎉'.repeat(20));
    console.log('🎉 所有测试通过！Sealos MongoDB 部署验证成功！');
    console.log('🎉'.repeat(20));
    
    console.log('\n📋 测试总结:');
    console.log('   ✅ 数据库连接验证');
    console.log('   ✅ 认证和权限验证');
    console.log('   ✅ CRUD 操作测试');
    console.log('   ✅ 数据持久化测试');
    console.log('   ✅ 连接池性能测试');
    console.log('   ✅ 错误处理机制测试');
    console.log('   ✅ 并发操作测试');
    console.log('   ✅ 性能基准测试');
    
    console.log('\n🔧 部署建议:');
    console.log('   - MongoDB 连接配置正确，可以用于生产环境');
    console.log('   - 连接池配置合理，支持高并发访问');
    console.log('   - 错误处理机制完善，具备良好的容错能力');
    console.log('   - 数据持久化正常，支持应用重启后数据恢复');
    
  } catch (error) {
    console.error('\n❌ 测试套件执行失败:', error);
    process.exit(1);
  }
}

// 运行完整测试
if (require.main === module) {
  runCompleteTests()
    .then(() => {
      console.log('\n✨ 数据库完整测试套件执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 测试套件执行失败:', error);
      process.exit(1);
    });
}