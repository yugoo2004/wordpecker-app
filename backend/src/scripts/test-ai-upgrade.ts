#!/usr/bin/env ts-node

/**
 * AI模型替换升级测试脚本
 * 用于验证豆包1.6、火山引擎TTS、SeeDream 3.0的集成
 */

import dotenv from 'dotenv';
import { runAIUpgradeTests } from '../tests/ai-upgrade-test';

// 加载环境变量
dotenv.config();

async function main() {
  console.log('🚀 开始AI模型替换升级测试...\n');
  
  try {
    await runAIUpgradeTests();
    console.log('\n🎉 所有测试通过！AI模型替换升级成功完成。');
  } catch (error) {
    console.error('\n💥 测试失败:', error);
    process.exit(1);
  }
}

// 运行主函数
main().catch((error) => {
  console.error('测试脚本执行失败:', error);
  process.exit(1);
});