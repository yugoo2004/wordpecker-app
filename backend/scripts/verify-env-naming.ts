#!/usr/bin/env ts-node

/**
 * 环境变量命名一致性验证脚本
 * 验证所有 SeeDream 相关的环境变量命名是否符合规范
 */

import dotenv from 'dotenv';
import path from 'path';

// 从项目根目录加载 .env 文件
const projectRoot = path.resolve(__dirname, '../..');
const envPath = path.join(projectRoot, '.env');
dotenv.config({ path: envPath });

console.log('🔍 环境变量命名规范验证\n');

interface NamingCheck {
  category: string;
  correct: string[];
  incorrect: string[];
  found: string[];
}

function checkEnvironmentVariables(): NamingCheck[] {
  const checks: NamingCheck[] = [
    {
      category: 'SeeDream 相关环境变量',
      correct: ['SEEDREAM_API_KEY', 'SEEDREAM_BASE_URL', 'SEEDREAM_MODEL', 'SEEDREAM_MAX_RETRIES', 'SEEDREAM_TIMEOUT'],
      incorrect: ['SEEDDREAM_API_KEY', 'SEEDRAM_API_KEY', 'SEEDDREAM_BASE_URL', 'SEEDRAM_BASE_URL'],
      found: []
    },
    {
      category: '图像服务提供商配置',
      correct: ['IMAGE_PROVIDER=seedream'],
      incorrect: ['IMAGE_PROVIDER=seeddream', 'IMAGE_PROVIDER=seedram'],
      found: []
    }
  ];

  // 检查当前环境变量
  const allEnvVars = Object.keys(process.env);
  
  for (const check of checks) {
    // 检查正确的变量
    for (const correctVar of check.correct) {
      const varName = correctVar.split('=')[0];
      if (allEnvVars.includes(varName)) {
        const value = process.env[varName];
        if (correctVar.includes('=')) {
          const expectedValue = correctVar.split('=')[1];
          if (value === expectedValue) {
            check.found.push(`✅ ${correctVar}`);
          } else {
            check.found.push(`⚠️  ${varName}=${value} (期望: ${expectedValue})`);
          }
        } else {
          check.found.push(`✅ ${varName}=${value}`);
        }
      }
    }
    
    // 检查错误的变量 - 只检查实际存在的变量
    for (const incorrectVar of check.incorrect) {
      const varName = incorrectVar.split('=')[0];
      if (allEnvVars.includes(varName)) {
        const value = process.env[varName];
        if (incorrectVar.includes('=')) {
          const incorrectValue = incorrectVar.split('=')[1];
          if (value === incorrectValue) {
            check.found.push(`❌ ${varName}=${value} (应该修正)`);
          }
        } else {
          check.found.push(`❌ ${varName}=${value} (应该修正)`);
        }
      }
    }
  }

  return checks;
}

function displayResults(checks: NamingCheck[]): void {
  let hasIssues = false;

  for (const check of checks) {
    console.log(`📋 ${check.category}:`);
    
    if (check.found.length === 0) {
      console.log('   未找到相关环境变量');
    } else {
      for (const found of check.found) {
        console.log(`   ${found}`);
        if (found.includes('❌') || found.includes('⚠️')) {
          hasIssues = true;
        }
      }
    }
    console.log('');
  }

  // 总结
  if (hasIssues) {
    console.log('❌ 发现命名不规范的环境变量，请修正后重新验证。');
    console.log('\n📖 命名规范:');
    console.log('   - SeeDream API 相关: SEEDREAM_*');
    console.log('   - 图像服务提供商: IMAGE_PROVIDER=seedream');
    console.log('   - 配置键值: seedream (小写)');
    console.log('   - 显示名称: SeeDream 3.0');
  } else {
    console.log('✅ 所有环境变量命名符合规范！');
  }
}

// 运行验证
if (require.main === module) {
  try {
    const checks = checkEnvironmentVariables();
    displayResults(checks);
  } catch (error) {
    console.error('验证失败:', error);
    process.exit(1);
  }
}