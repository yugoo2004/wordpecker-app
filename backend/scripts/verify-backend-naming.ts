#!/usr/bin/env ts-node

/**
 * 后端服务命名一致性验证脚本
 * 验证任务6的完成情况
 */

import fs from 'fs';
import path from 'path';

interface NamingIssue {
  file: string;
  line: number;
  issue: string;
  context: string;
}

class BackendNamingVerifier {
  private issues: NamingIssue[] = [];
  private srcDir = path.join(__dirname, '../src');

  async verify(): Promise<void> {
    console.log('🔍 开始验证后端服务命名一致性...\n');

    // 1. 验证SeedreamImageService类名和文件名
    await this.verifySeedreamImageService();

    // 2. 检查所有import语句和服务引用
    await this.verifyImportStatements();

    // 3. 验证AI服务配置中的命名规范
    await this.verifyAIServiceConfig();

    // 4. 确保日志输出使用正确的服务名称
    await this.verifyLogOutput();

    // 5. 检查是否还有错误的命名
    await this.checkForIncorrectNaming();

    this.generateReport();
  }

  private async verifySeedreamImageService(): Promise<void> {
    console.log('✅ 验证 SeedreamImageService 类名和文件名...');
    
    const serviceFile = path.join(this.srcDir, 'services/seedream-image-service.ts');
    
    if (!fs.existsSync(serviceFile)) {
      this.issues.push({
        file: serviceFile,
        line: 0,
        issue: '文件不存在',
        context: 'seedream-image-service.ts 文件应该存在'
      });
      return;
    }

    const content = fs.readFileSync(serviceFile, 'utf-8');
    const lines = content.split('\n');

    // 检查类名
    let hasCorrectClassName = false;
    lines.forEach((line, index) => {
      if (line.includes('export class SeedreamImageService')) {
        hasCorrectClassName = true;
        console.log(`  ✓ 类名正确: SeedreamImageService (第${index + 1}行)`);
      }
      if (line.includes('SeedRamImageService') || line.includes('SeedDreamImageService')) {
        this.issues.push({
          file: serviceFile,
          line: index + 1,
          issue: '错误的类名',
          context: line.trim()
        });
      }
    });

    if (!hasCorrectClassName) {
      this.issues.push({
        file: serviceFile,
        line: 0,
        issue: '未找到正确的类名',
        context: '应该有 export class SeedreamImageService'
      });
    }
  }

  private async verifyImportStatements(): Promise<void> {
    console.log('✅ 检查所有 import 语句和服务引用...');
    
    const tsFiles = this.getAllTsFiles(this.srcDir);
    
    for (const filePath of tsFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(this.srcDir, filePath);

      lines.forEach((line, index) => {
        // 检查import语句
        if (line.includes('import') && line.includes('seedream-image-service')) {
          console.log(`  ✓ 正确的import: ${relativePath}:${index + 1}`);
        }

        // 检查服务引用
        if (line.includes('getSeedreamImageService')) {
          console.log(`  ✓ 正确的服务引用: ${relativePath}:${index + 1}`);
        }

        // 检查错误的引用
        if (line.includes('SeedRamImageService') || line.includes('SeedDreamImageService')) {
          this.issues.push({
            file: filePath,
            line: index + 1,
            issue: '错误的服务类名引用',
            context: line.trim()
          });
        }
      });
    }
  }

  private async verifyAIServiceConfig(): Promise<void> {
    console.log('✅ 验证 AI 服务配置中的命名规范...');
    
    const configFiles = [
      'config/environment.ts',
      'config/ai-service.ts'
    ];

    for (const file of configFiles) {
      const filePath = path.join(this.srcDir, file);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 检查配置键值应该使用 seeddream
        if (line.includes('seeddream:') || line.includes("'seeddream'") || line.includes('"seeddream"')) {
          console.log(`  ✓ 正确的配置键值: ${file}:${index + 1}`);
        }

        // 检查错误的配置键值
        if (line.includes('seedram:') || line.includes('seeddream:') && line.includes('SeedRam')) {
          this.issues.push({
            file: filePath,
            line: index + 1,
            issue: '错误的配置键值',
            context: line.trim()
          });
        }
      });
    }
  }

  private async verifyLogOutput(): Promise<void> {
    console.log('✅ 确保日志输出使用正确的服务名称...');
    
    const tsFiles = this.getAllTsFiles(this.srcDir);
    
    for (const filePath of tsFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(this.srcDir, filePath);

      lines.forEach((line, index) => {
        // 检查日志中的服务名称
        if (line.includes('logger.') && line.includes('SeeDream 3.0')) {
          console.log(`  ✓ 正确的日志服务名称: ${relativePath}:${index + 1}`);
        }

        // 检查错误的日志服务名称
        if (line.includes('logger.') && (line.includes('SeedRam') || line.includes('SeedDream'))) {
          this.issues.push({
            file: filePath,
            line: index + 1,
            issue: '日志中使用了错误的服务名称',
            context: line.trim()
          });
        }
      });
    }
  }

  private async checkForIncorrectNaming(): Promise<void> {
    console.log('✅ 检查是否还有错误的命名...');
    
    const tsFiles = this.getAllTsFiles(this.srcDir);
    
    for (const filePath of tsFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(this.srcDir, filePath);

      lines.forEach((line, index) => {
        // 检查注释和字符串中的错误命名
        if (line.includes('SeedRam 3.0') || line.includes('SeedRam3.0')) {
          this.issues.push({
            file: filePath,
            line: index + 1,
            issue: '注释或字符串中使用了错误的服务名称',
            context: line.trim()
          });
        }
      });
    }
  }

  private getAllTsFiles(dir: string): string[] {
    const files: string[] = [];
    
    const scanDir = (currentDir: string) => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scanDir(fullPath);
        } else if (stat.isFile() && item.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
    };
    
    scanDir(dir);
    return files;
  }

  private generateReport(): void {
    console.log('\n📊 验证报告');
    console.log('='.repeat(50));

    if (this.issues.length === 0) {
      console.log('✅ 所有命名检查通过！后端服务命名一致性验证成功。');
      console.log('\n✅ 任务6完成情况:');
      console.log('  ✓ SeedreamImageService 类名和文件名正确');
      console.log('  ✓ 所有 import 语句和服务引用一致');
      console.log('  ✓ AI 服务配置中的命名规范正确');
      console.log('  ✓ 日志输出使用正确的服务名称');
      console.log('  ✓ 没有发现错误的命名');
    } else {
      console.log(`❌ 发现 ${this.issues.length} 个命名问题:`);
      
      this.issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.issue}`);
        console.log(`   文件: ${issue.file}`);
        console.log(`   行号: ${issue.line}`);
        console.log(`   上下文: ${issue.context}`);
      });
    }

    console.log('\n' + '='.repeat(50));
  }
}

// 运行验证
async function main() {
  const verifier = new BackendNamingVerifier();
  await verifier.verify();
}

if (require.main === module) {
  main().catch(console.error);
}