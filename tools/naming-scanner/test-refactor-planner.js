#!/usr/bin/env node

/**
 * 重构规划器功能验证测试
 */

import { RefactorPlanner } from './dist/planner/refactor-planner.js';
import { DependencyAnalyzer } from './dist/planner/dependency-analyzer.js';
import { ConflictDetector } from './dist/planner/conflict-detector.js';

async function testRefactorPlanner() {
  console.log('🧪 开始重构规划器功能验证测试...\n');

  try {
    // 1. 测试重构规划器创建
    console.log('1️⃣ 测试重构规划器创建...');
    const planner = new RefactorPlanner();
    console.log('✅ 重构规划器创建成功\n');

    // 2. 测试依赖分析器创建
    console.log('2️⃣ 测试依赖分析器创建...');
    const dependencyAnalyzer = new DependencyAnalyzer();
    console.log('✅ 依赖分析器创建成功\n');

    // 3. 测试冲突检测器创建
    console.log('3️⃣ 测试冲突检测器创建...');
    const conflictDetector = new ConflictDetector();
    console.log('✅ 冲突检测器创建成功\n');

    // 4. 测试创建简单的重构计划
    console.log('4️⃣ 测试创建简单的重构计划...');
    const mockScanResult = {
      files: [
        {
          filePath: 'test-file.ts',
          fileType: 'source',
          matches: [
            {
              category: 'environment',
              line: 1,
              column: 7,
              originalText: 'SEEDREAM_API_KEY',
              suggestedFix: 'SEEDREAM_API_KEY',
              context: 'const SEEDREAM_API_KEY = process.env.SEEDR