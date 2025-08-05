#!/usr/bin/env node

/**
 * 前后端通信测试脚本
 * 验证前端可以正确调用后端 API 并获取数据
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// 简单的 HTTP 请求函数
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 5000
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    req.end();
  });
}

// 配置
const FRONTEND_URL = 'http://localhost:5174';
const BACKEND_URL = 'http://localhost:3000';

async function testBackendAPIs() {
  console.log('🔍 测试后端 API 端点...\n');
  
  const tests = [
    { name: '健康检查', url: `${BACKEND_URL}/api/health` },
    { name: '就绪检查', url: `${BACKEND_URL}/api/ready` },
    { name: '词汇列表', url: `${BACKEND_URL}/api/lists` },
    { name: '模板列表', url: `${BACKEND_URL}/api/templates` },
    { name: '用户偏好', url: `${BACKEND_URL}/api/preferences` }
  ];

  for (const test of tests) {
    try {
      const response = await makeRequest(test.url, { timeout: 5000 });
      console.log(`✅ ${test.name}: ${response.status} - ${response.statusText}`);
      
      // 显示响应数据的简要信息
      if (response.data) {
        if (Array.isArray(response.data)) {
          console.log(`   📊 返回 ${response.data.length} 条记录`);
        } else if (typeof response.data === 'object') {
          console.log(`   📋 返回对象，包含字段: ${Object.keys(response.data).join(', ')}`);
        }
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
    console.log('');
  }
}

async function testFrontendAccess() {
  console.log('🌐 测试前端服务访问...\n');
  
  try {
    const response = await makeRequest(FRONTEND_URL, { timeout: 5000 });
    console.log(`✅ 前端服务: ${response.status} - ${response.statusText}`);
    console.log(`   📄 页面标题: ${response.data.match(/<title>(.*?)<\/title>/)?.[1] || '未找到标题'}`);
    console.log(`   📦 包含 React 应用: ${response.data.includes('id="root"') ? '是' : '否'}`);
  } catch (error) {
    console.log(`❌ 前端服务: ${error.message}`);
  }
  console.log('');
}

async function testCrossOriginRequest() {
  console.log('🔗 测试跨域请求 (模拟前端调用后端)...\n');
  
  try {
    // 模拟前端发起的 API 请求
    const response = await makeRequest(`${BACKEND_URL}/api/health`, {
      headers: {
        'Origin': FRONTEND_URL,
        'Referer': FRONTEND_URL
      },
      timeout: 5000
    });
    
    console.log(`✅ 跨域请求成功: ${response.status}`);
    console.log(`   🔒 CORS 头部: ${response.headers['access-control-allow-origin'] || '未设置'}`);
  } catch (error) {
    console.log(`❌ 跨域请求失败: ${error.message}`);
  }
  console.log('');
}

async function main() {
  console.log('🚀 WordPecker 前后端通信测试\n');
  console.log('='.repeat(50));
  console.log('');
  
  await testFrontendAccess();
  await testBackendAPIs();
  await testCrossOriginRequest();
  
  console.log('='.repeat(50));
  console.log('✨ 测试完成！');
}

// 运行测试
main().catch(console.error);