/**
 * 命名扫描器测试
 */

import { ContentScanner } from '../scanner/content-scanner';
import { ProblemAnalyzer } from '../analyzer/problem-analyzer';
import { NAMING_PATTERNS } from '../patterns/naming-patterns';

describe('NamingScanner', () => {
  let contentScanner: ContentScanner;
  let problemAnalyzer: ProblemAnalyzer;

  beforeEach(() => {
    contentScanner = new ContentScanner();
    problemAnalyzer = new ProblemAnalyzer();
  });

  describe('ContentScanner', () => {
    it('应该检测环境变量命名问题', () => {
      const content = `
SEEDDREAM_API_KEY=test
SEEDRAM_CONFIG=value
SEEDREAM_CORRECT=ok
      `.trim();

      const matches = contentScanner.scanContent(content, '.env');
      
      expect(matches.length).toBeGreaterThan(0);
      
      const envMatches = matches.filter(m => m.category === 'environment');
      expect(envMatches.length).toBe(2);
      
      expect(envMatches[0]?.originalText).toBe('SEEDDREAM_API_KEY');
      expect(envMatches[0]?.suggestedFix).toBe('SEEDREAM_API_KEY');
      
      expect(envMatches[1]?.originalText).toBe('SEEDRAM_CONFIG');
      expect(envMatches[1]?.suggestedFix).toBe('SEEDREAM_CONFIG');
    });

    it('应该检测配置键值命名问题', () => {
      const content = `
{
  "seeddream": true,
  "seedram": false,
  "seedream": "correct"
}
      `.trim();

      const matches = contentScanner.scanContent(content, 'config.json');
      
      const configMatches = matches.filter(m => m.category === 'config');
      expect(configMatches.length).toBe(2);
      
      expect(configMatches[0]?.suggestedFix).toBe('"seedream"');
      expect(configMatches[1]?.suggestedFix).toBe('"seedream"');
    });

    it('应该检测显示名称问题', () => {
      const content = `
<h1>SeedRam 3.0</h1>
<title>SeedDream Application</title>
<span>SeeDream 3.0</span>
      `.trim();

      const matches = contentScanner.scanContent(content, 'index.html');
      
      const displayMatches = matches.filter(m => m.category === 'display');
      expect(displayMatches.length).toBe(2);
      
      displayMatches.forEach(match => {
        expect(match.suggestedFix).toBe('SeeDream 3.0');
      });
    });

    it('应该检测类名问题', () => {
      const content = `
class SeedRamImageService {
  constructor() {}
}

interface SeedDreamConfig {
  apiKey: string;
}

class SeedreamService {
  // 正确的命名
}
      `.trim();

      const matches = contentScanner.scanContent(content, 'service.ts');
      
      const classMatches = matches.filter(m => m.category === 'class');
      expect(classMatches.length).toBe(2);
      
      expect(classMatches[0]?.originalText).toBe('SeedRamImageService');
      expect(classMatches[0]?.suggestedFix).toBe('SeedreamImageService');
      
      expect(classMatches[1]?.originalText).toBe('SeedDreamConfig');
      expect(classMatches[1]?.suggestedFix).toBe('SeedreamConfig');
    });

    it('应该检测变量名问题', () => {
      const content = `
const seedRamVariable = 'test';
let seedDreamConfig = {};
const seedreamCorrect = 'ok';
      `.trim();

      const matches = contentScanner.scanContent(content, 'variables.ts');
      
      const variableMatches = matches.filter(m => m.category === 'variable');
      expect(variableMatches.length).toBe(2);
      
      expect(variableMatches[0]?.originalText).toBe('seedRamVariable');
      expect(variableMatches[0]?.suggestedFix).toBe('seedreamVariable');
      
      expect(variableMatches[1]?.originalText).toBe('seedDreamConfig');
      expect(variableMatches[1]?.suggestedFix).toBe('seedreamConfig');
    });
  });

  describe('ProblemAnalyzer', () => {
    it('应该正确分析和分类问题', () => {
      const fileMatches = [
        {
          filePath: 'test.ts',
          fileType: 'source',
          matches: [
            {
              category: 'environment' as const,
              line: 1,
              column: 1,
              originalText: 'SEEDDREAM_API_KEY',
              suggestedFix: 'SEEDREAM_API_KEY',
              context: 'SEEDDREAM_API_KEY=test',
              severity: 'high' as const,
              pattern: '环境变量前缀'
            },
            {
              category: 'class' as const,
              line: 2,
              column: 1,
              originalText: 'SeedRamService',
              suggestedFix: 'SeedreamService',
              context: 'class SeedRamService',
              severity: 'medium' as const,
              pattern: '类名和接口名'
            }
          ],
          totalMatches: 2
        }
      ];

      const result = problemAnalyzer.analyzeScanResults(fileMatches);
      
      expect(result.totalMatches).toBe(2);
      expect(result.categories.environmentVariables.length).toBe(1);
      expect(result.categories.classNames.length).toBe(1);
      expect(result.summary.issuesBySeverity.high).toBe(1);
      expect(result.summary.issuesBySeverity.medium).toBe(1);
    });

    it('应该生成详细报告', () => {
      const fileMatches = [
        {
          filePath: 'test.ts',
          fileType: 'source',
          matches: [
            {
              category: 'environment' as const,
              line: 1,
              column: 1,
              originalText: 'SEEDDREAM_API_KEY',
              suggestedFix: 'SEEDREAM_API_KEY',
              context: 'SEEDDREAM_API_KEY=test',
              severity: 'high' as const,
              pattern: '环境变量前缀'
            }
          ],
          totalMatches: 1
        }
      ];

      const result = problemAnalyzer.analyzeScanResults(fileMatches);
      const report = problemAnalyzer.generateDetailedReport(result);
      
      expect(report).toContain('# SeeDream 命名标准化扫描报告');
      expect(report).toContain('## 📊 总体统计');
      expect(report).toContain('发现问题总数: 1');
      expect(report).toContain('高优先级问题: 1');
    });
  });

  describe('NamingPatterns', () => {
    it('应该包含所有必要的命名模式', () => {
      expect(NAMING_PATTERNS.length).toBeGreaterThan(0);
      
      const categories = NAMING_PATTERNS.map(p => p.category);
      expect(categories).toContain('environment');
      expect(categories).toContain('config');
      expect(categories).toContain('display');
      expect(categories).toContain('file');
      expect(categories).toContain('class');
      expect(categories).toContain('variable');
      expect(categories).toContain('api');
      expect(categories).toContain('database');
    });

    it('每个模式应该有正确的结构', () => {
      NAMING_PATTERNS.forEach(pattern => {
        expect(pattern.category).toBeDefined();
        expect(pattern.name).toBeDefined();
        expect(pattern.description).toBeDefined();
        expect(pattern.incorrectPatterns).toBeInstanceOf(Array);
        expect(pattern.incorrectPatterns.length).toBeGreaterThan(0);
        expect(pattern.correctFormat).toBeDefined();
        expect(pattern.contextRules).toBeInstanceOf(Array);
        expect(['high', 'medium', 'low']).toContain(pattern.severity);
      });
    });
  });
});