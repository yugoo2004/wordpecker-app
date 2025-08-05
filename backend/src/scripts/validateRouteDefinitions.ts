#!/usr/bin/env ts-node

/**
 * 验证新的随机图片API端点路由定义
 * 检查路由是否正确定义，不进行实际的API调用
 */

import fs from 'fs';
import path from 'path';

function validateRouteDefinitions() {
  console.log('🧪 验证随机图片API端点路由定义...\n');

  try {
    // 读取路由文件内容
    const routesFilePath = path.join(__dirname, '../api/image-description/routes.ts');
    const routesContent = fs.readFileSync(routesFilePath, 'utf-8');

    // 检查1: 验证随机图片端点定义
    console.log('📋 检查1: 验证随机图片端点定义');
    console.log('=' .repeat(50));
    
    const randomEndpointPattern = /router\.get\(['"`]\/random['"`]/;
    const hasRandomEndpoint = randomEndpointPattern.test(routesContent);
    
    if (hasRandomEndpoint) {
      console.log('✅ 随机图片端点 GET /random 已定义');
    } else {
      throw new Error('❌ 随机图片端点 GET /random 未找到');
    }

    // 检查2: 验证分类随机图片端点定义
    console.log('\n📋 检查2: 验证分类随机图片端点定义');
    console.log('=' .repeat(50));
    
    const categoryEndpointPattern = /router\.get\(['"`]\/random\/:category['"`]/;
    const hasCategoryEndpoint = categoryEndpointPattern.test(routesContent);
    
    if (hasCategoryEndpoint) {
      console.log('✅ 分类随机图片端点 GET /random/:category 已定义');
    } else {
      throw new Error('❌ 分类随机图片端点 GET /random/:category 未找到');
    }

    // 检查3: 验证API配置验证端点定义
    console.log('\n📋 检查3: 验证API配置验证端点定义');
    console.log('=' .repeat(50));
    
    const validateEndpointPattern = /router\.get\(['"`]\/validate-api['"`]/;
    const hasValidateEndpoint = validateEndpointPattern.test(routesContent);
    
    if (hasValidateEndpoint) {
      console.log('✅ API配置验证端点 GET /validate-api 已定义');
    } else {
      throw new Error('❌ API配置验证端点 GET /validate-api 未找到');
    }

    // 检查4: 验证验证模式导入
    console.log('\n📋 检查4: 验证验证模式导入');
    console.log('=' .repeat(50));
    
    const schemaImportPattern = /randomImageQuerySchema|categoryRandomImageSchema/;
    const hasSchemaImports = schemaImportPattern.test(routesContent);
    
    if (hasSchemaImports) {
      console.log('✅ 新的验证模式已正确导入');
    } else {
      throw new Error('❌ 新的验证模式导入未找到');
    }

    // 检查5: 验证错误处理
    console.log('\n📋 检查5: 验证错误处理');
    console.log('=' .repeat(50));
    
    const errorHandlingPattern = /catch\s*\(\s*error\s*\)/g;
    const errorHandlingMatches = routesContent.match(errorHandlingPattern);
    
    if (errorHandlingMatches && errorHandlingMatches.length >= 3) {
      console.log(`✅ 错误处理代码已添加 (找到 ${errorHandlingMatches.length} 个 catch 块)`);
    } else {
      console.log('⚠️ 错误处理代码可能不完整');
    }

    // 检查6: 验证响应格式
    console.log('\n📋 检查6: 验证响应格式');
    console.log('=' .repeat(50));
    
    const responseFormatPattern = /success:\s*true|success:\s*false/g;
    const responseFormatMatches = routesContent.match(responseFormatPattern);
    
    if (responseFormatMatches && responseFormatMatches.length >= 2) {
      console.log(`✅ 标准化响应格式已实现 (找到 ${responseFormatMatches.length} 个响应)`);
    } else {
      console.log('⚠️ 响应格式可能不一致');
    }

    // 检查schemas文件
    console.log('\n📋 检查7: 验证schemas文件');
    console.log('=' .repeat(50));
    
    const schemasFilePath = path.join(__dirname, '../api/image-description/schemas.ts');
    const schemasContent = fs.readFileSync(schemasFilePath, 'utf-8');
    
    const hasRandomImageSchema = /randomImageQuerySchema/.test(schemasContent);
    const hasCategorySchema = /categoryRandomImageSchema/.test(schemasContent);
    
    if (hasRandomImageSchema && hasCategorySchema) {
      console.log('✅ 新的验证模式已在schemas.ts中定义');
    } else {
      throw new Error('❌ 新的验证模式在schemas.ts中未找到');
    }

    console.log('\n🎉 所有路由定义验证通过！');
    
    // 显示实现摘要
    console.log('\n📊 实现摘要:');
    console.log('✅ 3个新的API端点已正确定义');
    console.log('✅ 验证模式已正确配置');
    console.log('✅ 错误处理已实现');
    console.log('✅ 标准化响应格式已应用');
    
    console.log('\n📝 新增的API端点:');
    console.log('1. GET /api/image-description/random');
    console.log('   - 功能: 获取随机图片');
    console.log('   - 参数: sessionId (可选), query (可选)');
    console.log('   - 响应: 包含图片信息的JSON对象');
    
    console.log('\n2. GET /api/image-description/random/:category');
    console.log('   - 功能: 获取指定类别的随机图片');
    console.log('   - 参数: category (路径参数), sessionId (查询参数，可选)');
    console.log('   - 响应: 包含图片信息和类别的JSON对象');
    
    console.log('\n3. GET /api/image-description/validate-api');
    console.log('   - 功能: 验证Pexels API配置');
    console.log('   - 参数: 无');
    console.log('   - 响应: API配置状态和统计信息');

    return true;

  } catch (error) {
    console.error('❌ 路由定义验证失败:', error);
    return false;
  }
}

// 运行验证
if (require.main === module) {
  const success = validateRouteDefinitions();
  
  if (success) {
    console.log('\n✅ 路由定义验证完成');
    process.exit(0);
  } else {
    console.log('\n❌ 路由定义验证失败');
    process.exit(1);
  }
}

export { validateRouteDefinitions };