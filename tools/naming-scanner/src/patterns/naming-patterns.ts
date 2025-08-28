/**
 * SeeDream 命名模式定义
 * 定义所有需要检测和修复的命名模式
 */

import { NamingPattern, ContextRule } from '../types/index.js';

// 环境变量命名规则
const environmentRules: ContextRule[] = [
  {
    filePattern: '\\.env.*',
    replacementTemplate: 'SEEDREAM_${suffix}',
    validationRule: (match: string, context: string) => {
      return context.includes('=') && !context.includes('#');
    }
  }
];

// 配置文件命名规则
const configRules: ContextRule[] = [
  {
    filePattern: '\\.(json|yaml|yml|js|ts)$',
    replacementTemplate: 'seedream',
    validationRule: (match: string, context: string) => {
      return context.includes(':') || context.includes('=');
    }
  }
];

// 显示名称规则
const displayRules: ContextRule[] = [
  {
    filePattern: '\\.(vue|jsx|tsx|html|md)$',
    replacementTemplate: 'SeeDream 3.0',
    validationRule: (match: string, context: string) => {
      return !context.includes('//') && !context.includes('/*');
    }
  }
];

// 文件名规则
const fileNameRules: ContextRule[] = [
  {
    filePattern: '.*',
    replacementTemplate: 'seedream-${suffix}',
    validationRule: (match: string, context: string) => {
      return true;
    }
  }
];

// 类名规则
const classNameRules: ContextRule[] = [
  {
    filePattern: '\\.(ts|js|tsx|jsx)$',
    replacementTemplate: 'Seedream${suffix}',
    validationRule: (match: string, context: string) => {
      return context.includes('class ') || context.includes('interface ') || context.includes('type ');
    }
  }
];

// 变量名规则
const variableRules: ContextRule[] = [
  {
    filePattern: '\\.(ts|js|tsx|jsx)$',
    replacementTemplate: 'seedream${suffix}',
    validationRule: (match: string, context: string) => {
      return !context.includes('class ') && !context.includes('interface ');
    }
  }
];

export const NAMING_PATTERNS: NamingPattern[] = [
  // 环境变量模式
  {
    category: 'environment',
    name: '环境变量前缀',
    description: '环境变量应使用 SEEDREAM_ 前缀',
    incorrectPatterns: [
      /SEEDDREAM_[A-Z_]+/g,
      /SEEDRAM_[A-Z_]+/g,
      /SEED_DREAM_[A-Z_]+/g
    ],
    correctFormat: 'SEEDREAM_*',
    contextRules: environmentRules,
    severity: 'high'
  },

  // 配置键值模式
  {
    category: 'config',
    name: '配置键值',
    description: '配置文件中应使用 seedream 作为键值',
    incorrectPatterns: [
      /["']seeddream["']/g,
      /["']seedram["']/g,
      /["']seed-dream["']/g,
      /["']seed_dream["']/g,
      /seeddream\s*:/g,
      /seedram\s*:/g,
      /seed-dream\s*:/g,
      /seed_dream\s*:/g
    ],
    correctFormat: 'seedream',
    contextRules: configRules,
    severity: 'medium'
  },

  // 显示名称模式
  {
    category: 'display',
    name: '显示名称',
    description: '用户可见的名称应为 SeeDream 3.0',
    incorrectPatterns: [
      /SeedRam\s*3\.0/g,
      /SeedDream\s*3\.0/g,
      /Seed\s*Dream\s*3\.0/g,
      /seeddream\s*3\.0/gi,
      /seedram\s*3\.0/gi,
      /SeedRam(?!\w)/g,
      /SeedDream(?!\w)/g
    ],
    correctFormat: 'SeeDream 3.0',
    contextRules: displayRules,
    severity: 'high'
  },

  // 文件名模式
  {
    category: 'file',
    name: '文件命名',
    description: '文件名应使用 seedream- 前缀',
    incorrectPatterns: [
      /seeddream-[\w-]+/g,
      /seedram-[\w-]+/g,
      /seed-dream-[\w-]+/g,
      /seed_dream_[\w-]+/g
    ],
    correctFormat: 'seedream-*',
    contextRules: fileNameRules,
    severity: 'medium'
  },

  // 类名模式
  {
    category: 'class',
    name: '类名和接口名',
    description: '类名和接口名应使用 Seedream 前缀',
    incorrectPatterns: [
      /SeedRam[A-Z]\w*/g,
      /SeedDream[A-Z]\w*/g,
      /Seed_Dream[A-Z]\w*/g,
      /SEEDRAM[A-Z]\w*/g,
      /SEEDDREAM[A-Z]\w*/g
    ],
    correctFormat: 'Seedream*',
    contextRules: classNameRules,
    severity: 'medium'
  },

  // 变量名模式
  {
    category: 'variable',
    name: '变量名和函数名',
    description: '变量名和函数名应使用 seedream 前缀',
    incorrectPatterns: [
      /seedRam[A-Z]\w*/g,
      /seedDream[A-Z]\w*/g,
      /seed_ram\w*/g,
      /seed_dream\w*/g,
      /seedram(?=[A-Z])/g,
      /seeddream(?=[A-Z])/g
    ],
    correctFormat: 'seedream*',
    contextRules: variableRules,
    severity: 'low'
  },

  // API 路由模式
  {
    category: 'api',
    name: 'API 路由',
    description: 'API 路由应使用 seedream 格式',
    incorrectPatterns: [
      /\/api\/seeddream/g,
      /\/api\/seedram/g,
      /\/api\/seed-dream/g,
      /\/seedram\//g,
      /\/seeddream\//g
    ],
    correctFormat: '/api/seedream',
    contextRules: [
      {
        filePattern: '\\.(ts|js)$',
        replacementTemplate: '/api/seedream',
        validationRule: (match: string, context: string) => {
          return context.includes('router') || context.includes('app.') || context.includes('express');
        }
      }
    ],
    severity: 'high'
  },

  // 数据库字段模式
  {
    category: 'database',
    name: '数据库字段',
    description: '数据库字段应使用 seedream 格式',
    incorrectPatterns: [
      /seedram_\w+/g,
      /seeddream_\w+/g,
      /seed_dream_\w+/g
    ],
    correctFormat: 'seedream_*',
    contextRules: [
      {
        filePattern: '\\.(ts|js)$',
        replacementTemplate: 'seedream_${suffix}',
        validationRule: (match: string, context: string) => {
          return context.includes('Schema') || context.includes('model') || context.includes('collection');
        }
      }
    ],
    severity: 'medium'
  }
];

/**
 * 根据文件类型获取相关的命名模式
 */
export function getPatternsForFileType(fileExtension: string): NamingPattern[] {
  const ext = fileExtension.toLowerCase();
  
  // 环境变量文件
  if (ext.includes('.env')) {
    return NAMING_PATTERNS.filter(p => p.category === 'environment');
  }
  
  // 配置文件
  if (['.json', '.yaml', '.yml'].includes(ext)) {
    return NAMING_PATTERNS.filter(p => ['config', 'display'].includes(p.category));
  }
  
  // 前端文件
  if (['.vue', '.jsx', '.tsx', '.html'].includes(ext)) {
    return NAMING_PATTERNS.filter(p => ['display', 'variable', 'class'].includes(p.category));
  }
  
  // TypeScript/JavaScript 文件
  if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
    return NAMING_PATTERNS.filter(p => ['variable', 'class', 'api', 'database'].includes(p.category));
  }
  
  // Markdown 文件
  if (['.md', '.mdx'].includes(ext)) {
    return NAMING_PATTERNS.filter(p => p.category === 'display');
  }
  
  // 默认返回所有模式
  return NAMING_PATTERNS;
}

/**
 * 获取文件名相关的模式
 */
export function getFileNamePatterns(): NamingPattern[] {
  return NAMING_PATTERNS.filter(p => p.category === 'file');
}