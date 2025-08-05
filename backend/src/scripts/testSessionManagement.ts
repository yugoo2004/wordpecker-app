#!/usr/bin/env ts-node

/**
 * 会话管理功能测试脚本
 * 用于验证新的会话管理和内存优化功能
 */

import { sessionManager } from '../api/image-description/session-manager';
import { stockPhotoService } from '../api/image-description/stock-photo-service';

async function testSessionManagement() {
  console.log('🧪 开始测试会话管理功能...\n');

  // 1. 测试会话创建和基本功能
  console.log('1️⃣ 测试会话创建和基本功能');
  const testSessionId = 'test-session-001';
  
  // 创建会话
  const session = sessionManager.getOrCreateSession(testSessionId);
  console.log(`✅ 创建会话: ${testSessionId}`);
  console.log(`   - 创建时间: ${new Date(session.createdAt).toISOString()}`);
  console.log(`   - 最后访问: ${new Date(session.lastAccess).toISOString()}`);

  // 2. 测试图片添加功能
  console.log('\n2️⃣ 测试图片添加功能');
  const testImages = [
    { url: 'https://example.com/nature1.jpg', category: 'nature' },
    { url: 'https://example.com/people1.jpg', category: 'people' },
    { url: 'https://example.com/business1.jpg', category: 'business' }
  ];

  for (const img of testImages) {
    sessionManager.addImageToSession(testSessionId, img.url, {
      timestamp: Date.now(),
      category: img.category,
      score: Math.random(),
      dimensions: { width: 1920, height: 1080 }
    });
    console.log(`✅ 添加图片: ${img.category} - ${img.url}`);
  }

  // 3. 测试重复图片添加
  console.log('\n3️⃣ 测试重复图片添加');
  sessionManager.addImageToSession(testSessionId, testImages[0].url, {
    timestamp: Date.now(),
    category: testImages[0].category,
    score: 0.9
  });
  console.log(`✅ 重复添加图片: ${testImages[0].url}`);

  // 4. 测试统计信息更新
  console.log('\n4️⃣ 测试统计信息更新');
  sessionManager.updateSessionStats(testSessionId, 150, true, 'nature');
  sessionManager.updateSessionStats(testSessionId, 200, true, 'people');
  sessionManager.updateSessionStats(testSessionId, 300, false);
  console.log('✅ 更新会话统计信息');

  // 5. 获取会话详细信息
  console.log('\n5️⃣ 获取会话详细信息');
  const sessionDetails = sessionManager.getSessionDetails(testSessionId);
  if (sessionDetails) {
    console.log(`✅ 会话详细信息:`);
    console.log(`   - 总图片数: ${sessionDetails.totalImages}`);
    console.log(`   - 请求次数: ${sessionDetails.requestCount}`);
    console.log(`   - 会话持续时间: ${(sessionDetails.sessionDuration / 1000).toFixed(2)}秒`);
    console.log(`   - 内存使用: ${(sessionDetails.memoryUsage / 1024).toFixed(2)}KB`);
    console.log(`   - 使用的类别: ${sessionDetails.categories.join(', ')}`);
  }

  // 6. 获取会话统计信息
  console.log('\n6️⃣ 获取会话统计信息');
  const sessionStats = sessionManager.getSessionStats(testSessionId);
  if (sessionStats) {
    console.log(`✅ 会话统计信息:`);
    console.log(`   - 总请求数: ${sessionStats.totalImageRequests}`);
    console.log(`   - 成功请求: ${sessionStats.successfulRequests}`);
    console.log(`   - 失败请求: ${sessionStats.failedRequests}`);
    console.log(`   - 平均响应时间: ${sessionStats.averageResponseTime.toFixed(2)}ms`);
    console.log(`   - 热门类别:`);
    Array.from(sessionStats.topCategories.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`     * ${category}: ${count}次`);
      });
  }

  // 7. 测试多会话管理
  console.log('\n7️⃣ 测试多会话管理');
  const additionalSessions = ['session-002', 'session-003', 'session-004'];
  
  for (const sessionId of additionalSessions) {
    sessionManager.getOrCreateSession(sessionId);
    sessionManager.addImageToSession(sessionId, `https://example.com/${sessionId}.jpg`, {
      timestamp: Date.now(),
      category: 'test',
      score: 0.7
    });
    console.log(`✅ 创建并配置会话: ${sessionId}`);
  }

  // 8. 获取全局统计信息
  console.log('\n8️⃣ 获取全局统计信息');
  const globalStats = sessionManager.getGlobalStats();
  console.log(`✅ 全局统计信息:`);
  console.log(`   - 活跃会话数: ${globalStats.activeSessions}`);
  console.log(`   - 总图片数: ${globalStats.totalImagesTracked}`);
  console.log(`   - 总内存使用: ${(globalStats.totalMemoryUsage / 1024).toFixed(2)}KB`);
  console.log(`   - 平均会话年龄: ${(globalStats.averageSessionAge / 1000).toFixed(2)}秒`);
  console.log(`   - 今日创建会话: ${globalStats.sessionsCreatedToday}`);

  // 9. 测试会话导出功能
  console.log('\n9️⃣ 测试会话导出功能');
  const exportData = sessionManager.exportSessionData();
  console.log(`✅ 导出数据:`);
  console.log(`   - 导出会话数: ${exportData.sessions.length}`);
  console.log(`   - 配置信息: 超时=${exportData.config.sessionTimeout}ms, 最大会话=${exportData.config.maxSessions}`);
  
  // 显示前3个会话的详细信息
  exportData.sessions.slice(0, 3).forEach((session, index) => {
    console.log(`   - 会话${index + 1}: ${session.sessionId}`);
    console.log(`     * 图片数: ${session.imageCount}`);
    console.log(`     * 请求数: ${session.requestCount}`);
    console.log(`     * 内存使用: ${(session.memoryUsage / 1024).toFixed(2)}KB`);
    console.log(`     * 热门类别: ${session.topCategories.slice(0, 2).map(c => c.category).join(', ')}`);
  });

  // 10. 测试会话清理功能
  console.log('\n🔟 测试会话清理功能');
  const sessionToDelete = 'session-002';
  const cleared = sessionManager.clearSession(sessionToDelete, 'test_cleanup');
  console.log(`✅ 清理会话 ${sessionToDelete}: ${cleared ? '成功' : '失败'}`);

  // 验证清理结果
  const afterCleanupStats = sessionManager.getGlobalStats();
  console.log(`   - 清理后活跃会话数: ${afterCleanupStats.activeSessions}`);

  // 11. 测试配置更新
  console.log('\n1️⃣1️⃣ 测试配置更新');
  const originalConfig = sessionManager.getConfig();
  console.log(`✅ 原始配置:`);
  console.log(`   - 会话超时: ${originalConfig.sessionTimeout}ms`);
  console.log(`   - 最大会话数: ${originalConfig.maxSessions}`);

  sessionManager.updateConfig({
    sessionTimeout: 30000, // 30秒
    maxSessions: 50
  });

  const updatedConfig = sessionManager.getConfig();
  console.log(`✅ 更新后配置:`);
  console.log(`   - 会话超时: ${updatedConfig.sessionTimeout}ms`);
  console.log(`   - 最大会话数: ${updatedConfig.maxSessions}`);

  // 12. 测试事件系统
  console.log('\n1️⃣2️⃣ 测试事件系统');
  
  // 监听事件
  sessionManager.once('session-created', (sessionId) => {
    console.log(`✅ 事件触发: 会话创建 - ${sessionId}`);
  });

  sessionManager.once('session-cleaned', (sessionId, reason) => {
    console.log(`✅ 事件触发: 会话清理 - ${sessionId} (原因: ${reason})`);
  });

  // 触发事件
  const eventTestSession = 'event-test-session';
  sessionManager.getOrCreateSession(eventTestSession);
  
  // 等待一小段时间让事件处理完成
  await new Promise(resolve => setTimeout(resolve, 100));
  
  sessionManager.clearSession(eventTestSession, 'event_test');

  // 13. 性能测试
  console.log('\n1️⃣3️⃣ 性能测试');
  const performanceTestStart = Date.now();
  
  // 创建大量会话和图片
  for (let i = 0; i < 100; i++) {
    const sessionId = `perf-test-${i}`;
    sessionManager.getOrCreateSession(sessionId);
    
    for (let j = 0; j < 5; j++) {
      sessionManager.addImageToSession(sessionId, `https://example.com/perf-${i}-${j}.jpg`, {
        timestamp: Date.now(),
        category: `category-${j % 3}`,
        score: Math.random()
      });
    }
    
    sessionManager.updateSessionStats(sessionId, Math.random() * 200, Math.random() > 0.1, `category-${i % 3}`);
  }

  const performanceTestEnd = Date.now();
  const performanceTestDuration = performanceTestEnd - performanceTestStart;
  
  console.log(`✅ 性能测试完成:`);
  console.log(`   - 创建100个会话，每个5张图片`);
  console.log(`   - 耗时: ${performanceTestDuration}ms`);
  console.log(`   - 平均每会话: ${(performanceTestDuration / 100).toFixed(2)}ms`);

  const finalStats = sessionManager.getGlobalStats();
  console.log(`   - 最终会话数: ${finalStats.activeSessions}`);
  console.log(`   - 最终图片数: ${finalStats.totalImagesTracked}`);
  console.log(`   - 最终内存使用: ${(finalStats.totalMemoryUsage / 1024 / 1024).toFixed(2)}MB`);

  // 14. 清理测试数据
  console.log('\n1️⃣4️⃣ 清理测试数据');
  const cleanupStart = Date.now();
  
  // 获取所有会话并清理
  const allSessions = sessionManager.exportSessionData().sessions;
  let cleanedCount = 0;
  
  for (const session of allSessions) {
    if (sessionManager.clearSession(session.sessionId, 'test_cleanup')) {
      cleanedCount++;
    }
  }
  
  const cleanupEnd = Date.now();
  const cleanupDuration = cleanupEnd - cleanupStart;
  
  console.log(`✅ 清理完成:`);
  console.log(`   - 清理会话数: ${cleanedCount}`);
  console.log(`   - 清理耗时: ${cleanupDuration}ms`);

  const finalCleanupStats = sessionManager.getGlobalStats();
  console.log(`   - 剩余会话数: ${finalCleanupStats.activeSessions}`);

  console.log('\n🎉 会话管理功能测试完成！');
  
  // 销毁会话管理器
  sessionManager.destroy();
}

// 运行测试
if (require.main === module) {
  testSessionManagement().catch(console.error);
}

export { testSessionManagement };