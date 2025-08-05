#!/usr/bin/env node

/**
 * WordPecker 核心功能端到端测试脚本
 * 
 * 测试内容：
 * 1. 词汇列表创建和管理功能
 * 2. OpenAI API 集成 (词汇生成、定义、例句)
 * 3. 语音对话功能 (OpenAI Realtime API)
 * 4. 图像描述功能
 * 
 * 使用方法：
 * node scripts/test-core-functionality-e2e.js [backend_url] [frontend_url]
 * 
 * 示例：
 * node scripts/test-core-functionality-e2e.js http://localhost:3000 http://localhost:5173
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// 配置
const BACKEND_URL = process.argv[2] || 'http://localhost:3000';
const FRONTEND_URL = process.argv[3] || 'http://localhost:5173';
const TEST_USER_ID = 'test-user-e2e-' + Date.now();

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  details: []
};

// 工具函数
const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeRequest = async (method, url, data = null, headers = {}) => {
  return new Promise((resolve) => {
    try {
      const fullUrl = `${BACKEND_URL}${url}`;
      const urlObj = new URL(fullUrl);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const requestHeaders = {
        'Content-Type': 'application/json',
        'user-id': TEST_USER_ID,
        ...headers
      };
      
      const postData = data ? JSON.stringify(data) : null;
      if (postData) {
        requestHeaders['Content-Length'] = Buffer.byteLength(postData);
      }
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method.toUpperCase(),
        headers: requestHeaders,
        timeout: 10000
      };
      
      const req = httpModule.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = responseData ? JSON.parse(responseData) : {};
            resolve({
              success: res.statusCode >= 200 && res.statusCode < 300,
              data: parsedData,
              status: res.statusCode,
              error: res.statusCode >= 400 ? parsedData : null
            });
          } catch (parseError) {
            resolve({
              success: false,
              error: `JSON parse error: ${parseError.message}`,
              status: res.statusCode
            });
          }
        });
      });
      
      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          status: 500
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout',
          status: 408
        });
      });
      
      if (postData) {
        req.write(postData);
      }
      
      req.end();
    } catch (error) {
      resolve({
        success: false,
        error: error.message,
        status: 500
      });
    }
  });
};

const runTest = async (testName, testFunction) => {
  log(`开始测试: ${testName}`);
  try {
    const result = await testFunction();
    if (result.success) {
      testResults.passed++;
      testResults.details.push({ test: testName, status: 'PASSED', details: result.details });
      log(`测试通过: ${testName}`, 'success');
    } else {
      testResults.failed++;
      testResults.errors.push(`${testName}: ${result.error}`);
      testResults.details.push({ test: testName, status: 'FAILED', error: result.error });
      log(`测试失败: ${testName} - ${result.error}`, 'error');
    }
  } catch (error) {
    testResults.failed++;
    testResults.errors.push(`${testName}: ${error.message}`);
    testResults.details.push({ test: testName, status: 'ERROR', error: error.message });
    log(`测试错误: ${testName} - ${error.message}`, 'error');
  }
};

// 测试函数定义
const testHealthCheck = async () => {
  const response = await makeRequest('GET', '/api/health');
  
  if (!response.success) {
    return { success: false, error: `健康检查失败: ${response.error}` };
  }
  
  const health = response.data;
  if (health.status !== 'healthy') {
    return { success: false, error: `服务状态不健康: ${health.status}` };
  }
  
  if (health.services.database !== 'connected') {
    return { success: false, error: `数据库未连接: ${health.services.database}` };
  }
  
  if (health.services.openai !== 'configured') {
    return { success: false, error: `OpenAI API 未配置: ${health.services.openai}` };
  }
  
  return {
    success: true,
    details: {
      status: health.status,
      database: health.services.database,
      openai: health.services.openai,
      uptime: health.uptime
    }
  };
};

const testReadinessCheck = async () => {
  const response = await makeRequest('GET', '/api/ready');
  
  if (!response.success) {
    return { success: false, error: `就绪检查失败: ${response.error}` };
  }
  
  const ready = response.data;
  if (!ready.ready) {
    return { success: false, error: `服务未就绪: ${ready.errors?.join(', ')}` };
  }
  
  return {
    success: true,
    details: {
      ready: ready.ready,
      checks: ready.checks
    }
  };
};

const testWordListManagement = async () => {
  // 1. 创建词汇列表
  const createResponse = await makeRequest('POST', '/api/lists', {
    name: 'E2E 测试列表',
    description: '端到端测试用词汇列表',
    context: 'Technology and Programming'
  });
  
  if (!createResponse.success) {
    return { success: false, error: `创建列表失败: ${createResponse.error}` };
  }
  
  const listId = createResponse.data.id;
  
  // 2. 获取列表详情
  const getResponse = await makeRequest('GET', `/api/lists/${listId}`);
  if (!getResponse.success) {
    return { success: false, error: `获取列表失败: ${getResponse.error}` };
  }
  
  // 3. 更新列表
  const updateResponse = await makeRequest('PUT', `/api/lists/${listId}`, {
    name: 'E2E 测试列表 (已更新)',
    description: '端到端测试用词汇列表 - 已更新'
  });
  
  if (!updateResponse.success) {
    return { success: false, error: `更新列表失败: ${updateResponse.error}` };
  }
  
  // 4. 获取所有列表
  const listAllResponse = await makeRequest('GET', '/api/lists');
  if (!listAllResponse.success) {
    return { success: false, error: `获取所有列表失败: ${listAllResponse.error}` };
  }
  
  const lists = listAllResponse.data;
  const testList = lists.find(list => list.id === listId);
  if (!testList) {
    return { success: false, error: '创建的测试列表未在列表中找到' };
  }
  
  return {
    success: true,
    details: {
      listId,
      listName: testList.name,
      wordCount: testList.wordCount,
      averageProgress: testList.averageProgress
    }
  };
};

const testVocabularyGeneration = async () => {
  // 1. 生成词汇
  const generateResponse = await makeRequest('POST', '/api/vocabulary/generate-words', {
    context: 'Technology and Programming',
    count: 5,
    difficulty: 'intermediate'
  });
  
  if (!generateResponse.success) {
    return { success: false, error: `词汇生成失败: ${generateResponse.error}` };
  }
  
  const vocabulary = generateResponse.data;
  if (!vocabulary.words || vocabulary.words.length === 0) {
    return { success: false, error: '生成的词汇列表为空' };
  }
  
  // 2. 获取单词详情
  const firstWord = vocabulary.words[0];
  const detailsResponse = await makeRequest('POST', '/api/vocabulary/get-word-details', {
    word: firstWord.word,
    context: 'Technology and Programming'
  });
  
  if (!detailsResponse.success) {
    return { success: false, error: `获取单词详情失败: ${detailsResponse.error}` };
  }
  
  const wordDetails = detailsResponse.data;
  if (!wordDetails.meaning || !wordDetails.example) {
    return { success: false, error: '单词详情不完整' };
  }
  
  return {
    success: true,
    details: {
      generatedWords: vocabulary.words.length,
      context: vocabulary.context,
      difficulty: vocabulary.difficulty,
      sampleWord: {
        word: wordDetails.word,
        meaning: wordDetails.meaning,
        example: wordDetails.example,
        difficulty_level: wordDetails.difficulty_level
      }
    }
  };
};

const testLearningSession = async () => {
  // 首先创建一个包含单词的列表
  const createListResponse = await makeRequest('POST', '/api/lists', {
    name: 'E2E 学习测试列表',
    description: '用于测试学习功能的列表',
    context: 'Daily Conversation'
  });
  
  if (!createListResponse.success) {
    return { success: false, error: `创建学习列表失败: ${createListResponse.error}` };
  }
  
  const listId = createListResponse.data.id;
  
  // 添加一些测试单词
  const testWords = [
    { word: 'hello', meaning: '你好，问候语' },
    { word: 'world', meaning: '世界，全球' },
    { word: 'computer', meaning: '计算机，电脑' },
    { word: 'programming', meaning: '编程，程序设计' },
    { word: 'language', meaning: '语言，编程语言' }
  ];
  
  for (const wordData of testWords) {
    const addWordResponse = await makeRequest('POST', `/api/lists/${listId}/words`, {
      word: wordData.word,
      meaning: wordData.meaning
    });
    
    if (!addWordResponse.success) {
      log(`添加单词 ${wordData.word} 失败: ${addWordResponse.error}`, 'error');
    }
  }
  
  // 等待一下确保单词已添加
  await sleep(1000);
  
  // 开始学习会话
  const startResponse = await makeRequest('POST', `/api/learn/${listId}/start`);
  
  if (!startResponse.success) {
    return { success: false, error: `开始学习会话失败: ${startResponse.error}` };
  }
  
  const session = startResponse.data;
  if (!session.exercises || session.exercises.length === 0) {
    return { success: false, error: '学习会话未生成练习题' };
  }
  
  // 获取更多练习
  const moreResponse = await makeRequest('POST', `/api/learn/${listId}/more`);
  
  if (!moreResponse.success) {
    return { success: false, error: `获取更多练习失败: ${moreResponse.error}` };
  }
  
  return {
    success: true,
    details: {
      listId,
      listName: session.list.name,
      exerciseCount: session.exercises.length,
      exerciseTypes: session.exercises.map(ex => ex.type),
      moreExerciseCount: moreResponse.data.exercises.length
    }
  };
};

const testVoiceSession = async () => {
  // 首先创建一个测试列表
  const createListResponse = await makeRequest('POST', '/api/lists', {
    name: 'E2E 语音测试列表',
    description: '用于测试语音功能的列表',
    context: 'Travel and Culture'
  });
  
  if (!createListResponse.success) {
    return { success: false, error: `创建语音测试列表失败: ${createListResponse.error}` };
  }
  
  const listId = createListResponse.data.id;
  
  // 创建语音会话
  const sessionResponse = await makeRequest('POST', '/api/voice/session', {
    listId: listId
  });
  
  if (!sessionResponse.success) {
    return { success: false, error: `创建语音会话失败: ${sessionResponse.error}` };
  }
  
  const session = sessionResponse.data;
  if (!session.success || !session.data.clientSecret) {
    return { success: false, error: '语音会话响应格式不正确' };
  }
  
  return {
    success: true,
    details: {
      listId,
      sessionId: session.data.sessionId,
      expiresAt: session.data.expiresAt,
      listContext: session.data.listContext,
      userLanguages: session.data.userLanguages
    }
  };
};

const testImageDescription = async () => {
  // 1. 开始图像描述练习
  const startResponse = await makeRequest('POST', '/api/describe/start', {
    context: 'A beautiful landscape scene',
    imageSource: 'stock'
  });
  
  if (!startResponse.success) {
    return { success: false, error: `开始图像描述失败: ${startResponse.error}` };
  }
  
  const exercise = startResponse.data;
  if (!exercise.context || !exercise.image || !exercise.instructions) {
    return { success: false, error: '图像描述练习响应不完整' };
  }
  
  // 2. 提交描述
  const submitResponse = await makeRequest('POST', '/api/describe/submit', {
    context: exercise.context,
    imageUrl: exercise.image.url,
    imageAlt: exercise.image.alt,
    userDescription: 'This is a beautiful landscape with mountains, trees, and a clear blue sky. The scene looks peaceful and serene, with natural colors and good lighting.'
  });
  
  if (!submitResponse.success) {
    return { success: false, error: `提交图像描述失败: ${submitResponse.error}` };
  }
  
  const analysis = submitResponse.data;
  if (!analysis.analysis || !analysis.analysis.feedback) {
    return { success: false, error: '图像描述分析响应不完整' };
  }
  
  // 3. 获取上下文建议
  const suggestionsResponse = await makeRequest('GET', '/api/describe/context-suggestions');
  
  if (!suggestionsResponse.success) {
    return { success: false, error: `获取上下文建议失败: ${suggestionsResponse.error}` };
  }
  
  return {
    success: true,
    details: {
      exerciseId: analysis.exerciseId,
      context: exercise.context,
      imageUrl: exercise.image.url,
      feedback: analysis.analysis.feedback,
      recommendedWords: analysis.analysis.recommendations?.length || 0,
      suggestions: suggestionsResponse.data.suggestions.length
    }
  };
};

const testFrontendAccess = async () => {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(FRONTEND_URL);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'GET',
        timeout: 10000
      };
      
      const req = httpModule.request(options, (res) => {
        let html = '';
        
        res.on('data', (chunk) => {
          html += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve({ success: false, error: `前端访问失败，状态码: ${res.statusCode}` });
            return;
          }
          
          if (!html.includes('WordPecker') && !html.includes('root')) {
            resolve({ success: false, error: '前端页面内容不正确' });
            return;
          }
          
          resolve({
            success: true,
            details: {
              status: res.statusCode,
              contentLength: html.length,
              hasReactRoot: html.includes('root')
            }
          });
        });
      });
      
      req.on('error', (error) => {
        resolve({ success: false, error: `前端访问错误: ${error.message}` });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: '前端访问超时' });
      });
      
      req.end();
    } catch (error) {
      resolve({ success: false, error: `前端访问错误: ${error.message}` });
    }
  });
};

// 主测试流程
const runAllTests = async () => {
  log('开始 WordPecker 核心功能端到端测试');
  log(`后端服务地址: ${BACKEND_URL}`);
  log(`前端服务地址: ${FRONTEND_URL}`);
  log(`测试用户ID: ${TEST_USER_ID}`);
  log('');
  
  // 基础健康检查
  await runTest('1. 后端健康检查', testHealthCheck);
  await runTest('2. 服务就绪检查', testReadinessCheck);
  await runTest('3. 前端访问测试', testFrontendAccess);
  
  // 核心功能测试
  await runTest('4. 词汇列表管理功能', testWordListManagement);
  await runTest('5. 词汇生成功能 (OpenAI API)', testVocabularyGeneration);
  await runTest('6. 学习会话功能', testLearningSession);
  await runTest('7. 语音对话功能 (OpenAI Realtime API)', testVoiceSession);
  await runTest('8. 图像描述功能', testImageDescription);
  
  // 生成测试报告
  const report = {
    timestamp: new Date().toISOString(),
    testEnvironment: {
      backendUrl: BACKEND_URL,
      frontendUrl: FRONTEND_URL,
      testUserId: TEST_USER_ID
    },
    summary: {
      total: testResults.passed + testResults.failed,
      passed: testResults.passed,
      failed: testResults.failed,
      successRate: `${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(2)}%`
    },
    results: testResults.details,
    errors: testResults.errors
  };
  
  // 保存测试报告
  const reportPath = path.join(__dirname, '..', 'core-functionality-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  log('');
  log('=== 测试结果汇总 ===');
  log(`总测试数: ${report.summary.total}`);
  log(`通过: ${report.summary.passed}`, 'success');
  log(`失败: ${report.summary.failed}`, report.summary.failed > 0 ? 'error' : 'info');
  log(`成功率: ${report.summary.successRate}`);
  log('');
  
  if (testResults.errors.length > 0) {
    log('失败的测试:');
    testResults.errors.forEach(error => log(`  - ${error}`, 'error'));
    log('');
  }
  
  log(`详细测试报告已保存到: ${reportPath}`);
  
  // 返回适当的退出码
  process.exit(testResults.failed > 0 ? 1 : 0);
};

// 运行测试
runAllTests().catch(error => {
  log(`测试执行出错: ${error.message}`, 'error');
  process.exit(1);
});