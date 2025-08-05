import request from 'supertest';
import app from '../app';
import { connectDB } from '../config/mongodb';

async function testHealthEndpoints() {
  console.log('🔍 测试健康检查端点...');
  
  try {
    // 连接数据库
    await connectDB();
    console.log('✅ 数据库连接成功');

    // 测试 /api/health 端点
    console.log('\n📊 测试 /api/health 端点...');
    const healthResponse = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/);
    
    console.log('状态码:', healthResponse.status);
    console.log('响应内容:', JSON.stringify(healthResponse.body, null, 2));

    // 测试 /api/ready 端点
    console.log('\n🚀 测试 /api/ready 端点...');
    const readyResponse = await request(app)
      .get('/api/ready')
      .expect('Content-Type', /json/);
    
    console.log('状态码:', readyResponse.status);
    console.log('响应内容:', JSON.stringify(readyResponse.body, null, 2));

    console.log('\n✅ 健康检查端点测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    process.exit(0);
  }
}

testHealthEndpoints();