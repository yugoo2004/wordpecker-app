#!/usr/bin/env ts-node

/**
 * 测试新的随机图片API端点结构
 * 验证路由定义和验证模式是否正确
 */

import express from 'express';
import request from 'supertest';
import imageDescriptionRoutes from '../api/image-description/routes';

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api/image-description', imageDescriptionRoutes);

async function testApiEndpointStructure() {
  console.log('🧪 开始测试API端点结构...\n');

  try {
    // 测试1: 验证随机图片端点存在
    console.log('📋 测试1: 验证随机图片端点存在');
    console.log('=' .repeat(50));
    
    const randomResponse = await request(app)
      .get('/api/image-description/random')
      .expect((res) => {
        // 端点应该存在（不是404）
        if (res.status === 404) {
          throw new Error('随机图片端点不存在');
        }
      });
    
    console.log(`✅ 随机图片端点存在 (状态码: ${randomResponse.status})`);
    
    // 测试2: 验证分类随机图片端点存在
    console.log('\n📋 测试2: 验证分类随机图片端点存在');
    console.log('=' .repeat(50));
    
    const categoryResponse = await request(app)
      .get('/api/image-description/random/nature')
      .expect((res) => {
        // 端点应该存在（不是404）
        if (res.status === 404) {
          throw new Error('分类随机图片端点不存在');
        }
      });
    
    console.log(`✅ 分类随机图片端点存在 (状态码: ${categoryResponse.status})`);
    
    // 测试3: 验证API配置验证端点存在
    console.log('\n📋 测试3: 验证API配置验证端点存在');
    console.log('=' .repeat(50));
    
    const validateResponse = await request(app)
      .get('/api/image-description/validate-api')
      .expect((res) => {
        // 端点应该存在（不是404）
        if (res.status === 404) {
          throw new Error('API配置验证端点不存在');
        }
      });
    
    console.log(`✅ API配置验证端点存在 (状态码: ${validateResponse.status})`);
    
    // 测试4: 验证参数验证
    console.log('\n📋 测试4: 验证参数验证');
    console.log('=' .repeat(50));
    
    // 测试无效的分类参数
    const invalidCategoryResponse = await request(app)
      .get('/api/image-description/random/')  // 空分类
      .expect(404);  // 应该返回404，因为路由不匹配
    
    console.log(`✅ 空分类参数正确处理 (状态码: ${invalidCategoryResponse.status})`);
    
    // 测试5: 验证查询参数处理
    console.log('\n📋 测试5: 验证查询参数处理');
    console.log('=' .repeat(50));
    
    const queryParamsResponse = await request(app)
      .get('/api/image-description/random?sessionId=test&query=nature')
      .expect((res) => {
        // 端点应该能处理查询参数
        if (res.status === 404) {
          throw new Error('查询参数处理失败');
        }
      });
    
    console.log(`✅ 查询参数处理正常 (状态码: ${queryParamsResponse.status})`);
    
    console.log('\n🎉 所有端点结构测试通过！');
    
    // 显示端点摘要
    console.log('\n📊 新增API端点摘要:');
    console.log('1. GET /api/image-description/random - 获取随机图片');
    console.log('   - 查询参数: sessionId (可选), query (可选)');
    console.log('2. GET /api/image-description/random/:category - 获取分类随机图片');
    console.log('   - 路径参数: category (必需)');
    console.log('   - 查询参数: sessionId (可选)');
    console.log('3. GET /api/image-description/validate-api - 验证API配置');
    console.log('   - 无参数');

  } catch (error) {
    console.error('❌ 端点结构测试失败:', error);
    throw error;
  }
}

// 运行测试
if (require.main === module) {
  testApiEndpointStructure()
    .then(() => {
      console.log('\n✅ 端点结构测试完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 端点结构测试失败:', error);
      process.exit(1);
    });
}

export { testApiEndpointStructure };