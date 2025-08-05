import { z } from 'zod';
import { environment, validatePexelsApiKey } from '../../config/environment';
import { sessionManager, UserSession } from './session-manager';

// 随机数生成器增强 - 使用更好的随机性算法
class EnhancedRandom {
  private seed: number;
  
  constructor(seed?: number) {
    this.seed = seed || Date.now();
  }
  
  // 线性同余生成器，提供更好的随机分布
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
    return this.seed / Math.pow(2, 32);
  }
  
  // 生成指定范围内的随机整数
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  
  // Fisher-Yates 洗牌算法，确保真正的随机排列
  shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

const randomGenerator = new EnhancedRandom();

// 智能图片重用策略配置
const REUSE_STRATEGY = {
  // 图片重用的最小间隔时间（毫秒）
  MIN_REUSE_INTERVAL: 30 * 60 * 1000, // 30分钟
  // 会话内图片重用的阈值（当可用图片少于此数量时开始重用）
  REUSE_THRESHOLD: 3,
  // 图片质量评分权重
  QUALITY_WEIGHTS: {
    recency: 0.3,    // 时间新鲜度权重
    diversity: 0.4,  // 多样性权重
    relevance: 0.3   // 相关性权重
  }
};

// 会话管理现在由 SessionManager 处理

export const StockPhotoResult = z.object({
  id: z.string().describe('Unique identifier for the stock photo'),
  url: z.string().describe('Direct URL to the stock photo'),
  alt_description: z.string().describe('Alternative text description of the photo'),
  description: z.string().describe('Detailed description of the photo content'),
  prompt: z.string().describe('The search query used to find the photo'),
  source: z.literal('pexels').describe('Source of the image - Pexels stock photo')
});

export type StockPhotoResultType = z.infer<typeof StockPhotoResult>;

// 错误类型定义
export interface ImageApiError {
  error: string;
  code: 'API_KEY_INVALID' | 'QUOTA_EXCEEDED' | 'NO_IMAGES_FOUND' | 'NETWORK_ERROR' | 'RATE_LIMITED' | 'UNKNOWN_ERROR';
  details?: string;
  retryAfter?: number;
}

// API 使用统计接口
export interface ApiUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastRequestTime: number;
  averageResponseTime: number;
  requestsPerHour: number;
  requestsToday: number;
  quotaUsage: {
    estimated: number;
    limit: number | null;
    resetTime: number | null;
  };
  errorBreakdown: {
    [key: string]: number;
  };
  performanceMetrics: {
    fastestResponse: number;
    slowestResponse: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
}

// 性能指标收集接口
export interface PerformanceMetrics {
  requestId: string;
  timestamp: number;
  responseTime: number;
  success: boolean;
  errorCode?: string;
  query?: string;
  sessionId?: string;
  cacheHit?: boolean;
}

export class StockPhotoService {
  private apiUsageStats: ApiUsageStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    lastRequestTime: 0,
    averageResponseTime: 0,
    requestsPerHour: 0,
    requestsToday: 0,
    quotaUsage: {
      estimated: 0,
      limit: null,
      resetTime: null
    },
    errorBreakdown: {},
    performanceMetrics: {
      fastestResponse: Infinity,
      slowestResponse: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0
    }
  };

  // 性能指标历史记录（保留最近1000条记录）
  private performanceHistory: PerformanceMetrics[] = [];
  private readonly MAX_PERFORMANCE_HISTORY = 1000;

  // 请求时间戳记录（用于计算每小时和每日请求数）
  private requestTimestamps: number[] = [];
  private readonly MAX_TIMESTAMP_HISTORY = 10000;

  /**
   * 获取或创建用户会话
   * @param sessionId - 会话ID
   * @returns UserSession - 用户会话对象
   */
  private getOrCreateUserSession(sessionId: string): UserSession {
    return sessionManager.getOrCreateSession(sessionId);
  }

  /**
   * 计算图片的重用评分
   * @param imageUrl - 图片URL
   * @param metadata - 图片元数据
   * @param category - 当前搜索类别
   * @returns number - 评分（0-1之间，越高越适合重用）
   */
  private calculateReuseScore(
    imageUrl: string, 
    metadata: { timestamp: number; category: string; score: number }, 
    category: string
  ): number {
    const now = Date.now();
    const timeSinceUsed = now - metadata.timestamp;
    
    // 时间新鲜度评分（时间越久评分越高）
    const recencyScore = Math.min(timeSinceUsed / REUSE_STRATEGY.MIN_REUSE_INTERVAL, 1);
    
    // 多样性评分（不同类别的图片评分更高）
    const diversityScore = metadata.category === category ? 0.2 : 1.0;
    
    // 相关性评分（使用之前的评分）
    const relevanceScore = metadata.score;
    
    // 综合评分
    const totalScore = 
      recencyScore * REUSE_STRATEGY.QUALITY_WEIGHTS.recency +
      diversityScore * REUSE_STRATEGY.QUALITY_WEIGHTS.diversity +
      relevanceScore * REUSE_STRATEGY.QUALITY_WEIGHTS.relevance;
    
    return totalScore;
  }

  /**
   * 智能选择图片 - 优先选择未使用的图片，智能重用已使用的图片
   * @param photos - 可用图片数组
   * @param session - 用户会话
   * @param category - 搜索类别
   * @returns any - 选中的图片对象
   */
  private intelligentImageSelection(photos: any[], session: UserSession, category: string): any {
    // 1. 首先尝试获取未使用的图片
    const unusedPhotos = photos.filter(photo => !session.images.has(photo.src.large));
    
    if (unusedPhotos.length > 0) {
      // 使用增强的随机算法选择未使用的图片
      const shuffledUnused = randomGenerator.shuffle(unusedPhotos);
      const selectedPhoto = shuffledUnused[0];
      
      console.log(`🎯 选择未使用图片: ${selectedPhoto.id} (可用未使用图片: ${unusedPhotos.length})`);
      return selectedPhoto;
    }
    
    // 2. 如果所有图片都已使用，应用智能重用策略
    console.log(`🔄 所有图片已使用，应用智能重用策略 (总图片数: ${photos.length})`);
    
    // 计算每张图片的重用评分
    const photosWithScores = photos.map(photo => {
      const metadata = session.imageMetadata.get(photo.src.large);
      if (!metadata) {
        // 如果没有元数据，给予中等评分
        return { photo, score: 0.5 };
      }
      
      const reuseScore = this.calculateReuseScore(photo.src.large, metadata, category);
      return { photo, score: reuseScore };
    });
    
    // 按评分排序，选择评分最高的几张图片
    photosWithScores.sort((a, b) => b.score - a.score);
    
    // 从评分最高的前30%中随机选择，增加随机性
    const topCandidatesCount = Math.max(1, Math.ceil(photosWithScores.length * 0.3));
    const topCandidates = photosWithScores.slice(0, topCandidatesCount);
    
    const shuffledCandidates = randomGenerator.shuffle(topCandidates);
    const selectedCandidate = shuffledCandidates[0];
    
    console.log(`🎲 智能重用选择: ${selectedCandidate.photo.id} (评分: ${selectedCandidate.score.toFixed(3)})`);
    
    return selectedCandidate.photo;
  }

  /**
   * 更新图片使用记录
   * @param sessionId - 会话ID
   * @param imageUrl - 图片URL
   * @param category - 图片类别
   * @param relevanceScore - 相关性评分
   * @param dimensions - 图片尺寸
   */
  private updateImageUsageRecord(
    sessionId: string,
    imageUrl: string, 
    category: string, 
    relevanceScore: number = 0.8,
    dimensions?: { width: number; height: number }
  ): void {
    sessionManager.addImageToSession(sessionId, imageUrl, {
      timestamp: Date.now(),
      category: category,
      score: relevanceScore,
      dimensions
    });
  }

  /**
   * 生成增强的图片描述和替代文本
   * @param photo - Pexels图片对象
   * @param searchQuery - 原始搜索查询
   * @param context - 上下文信息
   * @returns 增强的描述信息
   */
  private generateEnhancedImageDescription(photo: any, searchQuery: string, context?: string): {
    alt_description: string;
    description: string;
  } {
    // 获取原始信息
    const originalAlt = photo.alt || '';
    const photographer = photo.photographer || 'Unknown';
    const dimensions = photo.width && photo.height ? `${photo.width}x${photo.height}` : '';
    
    // 分析图片内容关键词
    const contentKeywords = this.extractContentKeywords(originalAlt, searchQuery);
    
    // 生成增强的替代文本
    let enhancedAlt = originalAlt;
    if (!enhancedAlt || enhancedAlt.length < 10) {
      // 如果原始alt文本不足，基于搜索查询生成
      enhancedAlt = this.generateAltFromQuery(searchQuery, contentKeywords);
    } else {
      // 增强现有的alt文本
      enhancedAlt = this.enhanceExistingAlt(originalAlt, searchQuery, contentKeywords);
    }
    
    // 生成详细描述
    const detailedDescription = this.generateDetailedDescription(
      enhancedAlt, 
      searchQuery, 
      photographer, 
      dimensions,
      context,
      contentKeywords
    );
    
    return {
      alt_description: enhancedAlt,
      description: detailedDescription
    };
  }

  /**
   * 从alt文本和搜索查询中提取内容关键词
   * @param altText - 原始alt文本
   * @param searchQuery - 搜索查询
   * @returns 内容关键词数组
   */
  private extractContentKeywords(altText: string, searchQuery: string): string[] {
    const keywords = new Set<string>();
    
    // 从搜索查询中提取关键词
    const queryWords = searchQuery.toLowerCase().split(/[\s,.-]+/).filter(word => word.length > 2);
    queryWords.forEach(word => keywords.add(word));
    
    // 从alt文本中提取关键词
    if (altText) {
      const altWords = altText.toLowerCase().split(/[\s,.-]+/).filter(word => word.length > 2);
      altWords.forEach(word => keywords.add(word));
    }
    
    // 过滤常见停用词
    const stopWords = new Set(['the', 'and', 'with', 'for', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should']);
    
    return Array.from(keywords).filter(word => !stopWords.has(word));
  }

  /**
   * 基于搜索查询生成alt文本
   * @param searchQuery - 搜索查询
   * @param keywords - 内容关键词
   * @returns 生成的alt文本
   */
  private generateAltFromQuery(searchQuery: string, keywords: string[]): string {
    // 基础模板
    const templates = [
      `A high-quality photograph featuring ${searchQuery}`,
      `Professional stock photo showing ${searchQuery}`,
      `Detailed image depicting ${searchQuery}`,
      `High-resolution photograph of ${searchQuery}`,
      `Stock photography featuring ${searchQuery}`
    ];
    
    // 随机选择模板
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // 如果有额外关键词，添加到描述中
    if (keywords.length > 1) {
      const additionalKeywords = keywords.filter(k => !searchQuery.toLowerCase().includes(k)).slice(0, 2);
      if (additionalKeywords.length > 0) {
        return `${template} with elements of ${additionalKeywords.join(' and ')}`;
      }
    }
    
    return template;
  }

  /**
   * 增强现有的alt文本
   * @param originalAlt - 原始alt文本
   * @param searchQuery - 搜索查询
   * @param keywords - 内容关键词
   * @returns 增强的alt文本
   */
  private enhanceExistingAlt(originalAlt: string, searchQuery: string, keywords: string[]): string {
    let enhanced = originalAlt.trim();
    
    // 确保首字母大写
    enhanced = enhanced.charAt(0).toUpperCase() + enhanced.slice(1);
    
    // 如果alt文本太短，添加更多描述
    if (enhanced.length < 30) {
      const missingKeywords = keywords.filter(k => 
        !enhanced.toLowerCase().includes(k) && 
        !searchQuery.toLowerCase().includes(k)
      ).slice(0, 2);
      
      if (missingKeywords.length > 0) {
        enhanced += `, featuring ${missingKeywords.join(' and ')}`;
      }
    }
    
    // 确保以句号结尾
    if (!enhanced.endsWith('.') && !enhanced.endsWith('!') && !enhanced.endsWith('?')) {
      enhanced += '.';
    }
    
    return enhanced;
  }

  /**
   * 生成详细的图片描述
   * @param altText - 增强的alt文本
   * @param searchQuery - 搜索查询
   * @param photographer - 摄影师名称
   * @param dimensions - 图片尺寸
   * @param context - 上下文信息
   * @param keywords - 内容关键词
   * @returns 详细描述
   */
  private generateDetailedDescription(
    altText: string, 
    searchQuery: string, 
    photographer: string, 
    dimensions: string,
    context?: string,
    keywords: string[] = []
  ): string {
    let description = `Professional stock photograph from Pexels`;
    
    // 添加摄影师信息
    if (photographer && photographer !== 'Unknown') {
      description += ` by ${photographer}`;
    }
    
    // 添加主要内容描述
    description += `. ${altText}`;
    
    // 添加上下文相关性
    if (context && context !== searchQuery) {
      description += ` This image is particularly relevant for ${context} contexts`;
    }
    
    // 添加学习价值描述
    const learningValue = this.generateLearningValueDescription(keywords, searchQuery);
    if (learningValue) {
      description += `. ${learningValue}`;
    }
    
    // 添加质量信息
    if (dimensions) {
      description += ` Available in high resolution (${dimensions})`;
    }
    
    // 添加词汇学习机会描述
    description += `. Perfect for vocabulary building and language learning exercises`;
    
    return description;
  }

  /**
   * 生成学习价值描述
   * @param keywords - 内容关键词
   * @param searchQuery - 搜索查询
   * @returns 学习价值描述
   */
  private generateLearningValueDescription(keywords: string[], searchQuery: string): string {
    if (keywords.length === 0) return '';
    
    const learningTemplates = [
      `Rich in vocabulary opportunities related to ${keywords.slice(0, 3).join(', ')}`,
      `Excellent for learning descriptive language about ${keywords.slice(0, 2).join(' and ')}`,
      `Provides context for vocabulary related to ${keywords.slice(0, 3).join(', ')}`,
      `Ideal for practicing descriptive language and ${keywords.slice(0, 2).join(', ')} vocabulary`
    ];
    
    return learningTemplates[Math.floor(Math.random() * learningTemplates.length)];
  }

  /**
   * 选择最佳质量的图片URL
   * @param photo - Pexels图片对象
   * @returns 最高质量的图片URL
   */
  private selectBestQualityUrl(photo: any): string {
    // Pexels API 提供多种尺寸的图片
    // 优先级：original > large2x > large > medium > small
    const srcOptions = photo.src || {};
    
    // 按质量优先级排序
    const qualityPriority = [
      'original',    // 原始尺寸（最高质量）
      'large2x',     // 大尺寸2倍
      'large',       // 大尺寸
      'medium',      // 中等尺寸
      'small'        // 小尺寸（最后选择）
    ];
    
    // 选择可用的最高质量URL
    for (const quality of qualityPriority) {
      if (srcOptions[quality]) {
        console.log(`🎯 选择图片质量: ${quality} (${photo.width}x${photo.height})`);
        return srcOptions[quality];
      }
    }
    
    // 如果都不可用，返回默认URL
    console.warn('⚠️ 未找到高质量图片URL，使用默认URL');
    return srcOptions.large || srcOptions.medium || srcOptions.small || '';
  }

  /**
   * 优化基于上下文的搜索查询生成
   * @param context - 原始上下文
   * @param sessionId - 会话ID（用于个性化）
   * @returns 优化的搜索查询
   */
  private optimizeSearchQuery(context: string, sessionId?: string): string {
    // 清理和标准化上下文
    let optimizedQuery = context.trim().toLowerCase();
    
    // 移除常见的停用词和无意义词汇
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'];
    const words = optimizedQuery.split(/[\s,.-]+/).filter(word => 
      word.length > 2 && !stopWords.includes(word)
    );
    
    // 如果处理后的词汇太少，使用原始上下文
    if (words.length === 0) {
      return context;
    }
    
    // 应用上下文增强策略
    optimizedQuery = this.applyContextEnhancement(words, sessionId);
    
    // 应用语义扩展
    optimizedQuery = this.applySemanticExpansion(optimizedQuery);
    
    console.log(`🔍 上下文优化: "${context}" → "${optimizedQuery}"`);
    
    return optimizedQuery;
  }

  /**
   * 应用上下文增强策略
   * @param words - 关键词数组
   * @param sessionId - 会话ID
   * @returns 增强的查询
   */
  private applyContextEnhancement(words: string[], sessionId?: string): string {
    // 获取会话历史以了解用户偏好
    let userPreferences: string[] = [];
    if (sessionId) {
      const session = sessionManager.getSessionDetails(sessionId);
      if (session) {
        userPreferences = session.categories || [];
      }
    }
    
    // 基于词汇类型进行增强
    const enhancedWords = words.map(word => {
      return this.enhanceWordWithContext(word, userPreferences);
    });
    
    // 组合增强后的词汇
    let enhancedQuery = enhancedWords.join(' ');
    
    // 如果查询太短，添加相关的描述词
    if (enhancedQuery.length < 10) {
      const descriptiveWords = this.getDescriptiveWords(words[0] || enhancedQuery);
      if (descriptiveWords.length > 0) {
        enhancedQuery += ' ' + descriptiveWords.join(' ');
      }
    }
    
    return enhancedQuery;
  }

  /**
   * 基于上下文增强单个词汇
   * @param word - 原始词汇
   * @param userPreferences - 用户偏好
   * @returns 增强的词汇
   */
  private enhanceWordWithContext(word: string, userPreferences: string[]): string {
    // 词汇映射表：将抽象概念映射到具体的视觉概念
    const conceptMapping: Record<string, string[]> = {
      // 学习相关
      'learning': ['student studying', 'books', 'education', 'classroom'],
      'education': ['school', 'teacher', 'students', 'learning'],
      'study': ['student reading', 'library', 'books', 'notes'],
      
      // 工作相关
      'work': ['office', 'business meeting', 'professional', 'workplace'],
      'business': ['office building', 'meeting', 'handshake', 'professional'],
      'meeting': ['conference room', 'business people', 'presentation'],
      
      // 技术相关
      'technology': ['computer', 'smartphone', 'digital device', 'innovation'],
      'computer': ['laptop', 'desktop computer', 'coding', 'programming'],
      'digital': ['technology', 'screen', 'device', 'modern'],
      
      // 生活方式
      'lifestyle': ['home', 'relaxation', 'daily life', 'comfort'],
      'health': ['fitness', 'wellness', 'exercise', 'healthy food'],
      'fitness': ['gym', 'exercise', 'workout', 'sports'],
      
      // 自然相关
      'nature': ['landscape', 'forest', 'mountains', 'outdoor'],
      'environment': ['nature', 'green', 'sustainability', 'eco-friendly'],
      
      // 艺术相关
      'art': ['painting', 'creative', 'artistic', 'gallery'],
      'creative': ['art', 'design', 'inspiration', 'artistic'],
      'design': ['modern design', 'creative', 'artistic', 'aesthetic']
    };
    
    // 检查是否有映射
    if (conceptMapping[word]) {
      const mappedOptions = conceptMapping[word];
      
      // 如果有用户偏好，优先选择匹配的选项
      if (userPreferences.length > 0) {
        const preferredOption = mappedOptions.find(option => 
          userPreferences.some(pref => option.includes(pref) || pref.includes(option))
        );
        if (preferredOption) {
          return preferredOption;
        }
      }
      
      // 随机选择一个映射选项
      return mappedOptions[Math.floor(Math.random() * mappedOptions.length)];
    }
    
    return word;
  }

  /**
   * 获取描述性词汇
   * @param baseWord - 基础词汇
   * @returns 描述性词汇数组
   */
  private getDescriptiveWords(baseWord: string): string[] {
    const descriptiveMap: Record<string, string[]> = {
      'person': ['professional', 'portrait', 'lifestyle'],
      'people': ['group', 'team', 'social'],
      'office': ['modern', 'professional', 'workspace'],
      'home': ['cozy', 'comfortable', 'interior'],
      'food': ['fresh', 'delicious', 'healthy'],
      'nature': ['beautiful', 'scenic', 'peaceful'],
      'technology': ['modern', 'innovative', 'digital'],
      'art': ['creative', 'colorful', 'inspiring']
    };
    
    // 查找匹配的描述词
    for (const [key, descriptors] of Object.entries(descriptiveMap)) {
      if (baseWord.includes(key) || key.includes(baseWord)) {
        return descriptors.slice(0, 2); // 返回前两个描述词
      }
    }
    
    // 默认描述词
    return ['high quality', 'professional'];
  }

  /**
   * 应用语义扩展
   * @param query - 基础查询
   * @returns 语义扩展后的查询
   */
  private applySemanticExpansion(query: string): string {
    // 语义相关词汇扩展
    const semanticExpansions: Record<string, string[]> = {
      'business': ['corporate', 'professional', 'office'],
      'student': ['learning', 'education', 'academic'],
      'technology': ['digital', 'modern', 'innovation'],
      'nature': ['outdoor', 'natural', 'environment'],
      'food': ['cuisine', 'cooking', 'dining'],
      'travel': ['journey', 'adventure', 'exploration'],
      'health': ['wellness', 'fitness', 'medical'],
      'art': ['creative', 'artistic', 'design']
    };
    
    let expandedQuery = query;
    
    // 检查是否可以进行语义扩展
    for (const [baseWord, expansions] of Object.entries(semanticExpansions)) {
      if (query.includes(baseWord)) {
        // 随机选择一个扩展词汇
        const expansion = expansions[Math.floor(Math.random() * expansions.length)];
        if (!query.includes(expansion)) {
          expandedQuery += ` ${expansion}`;
        }
        break; // 只应用一次扩展，避免查询过长
      }
    }
    
    return expandedQuery;
  }

  /**
   * 增强的随机查询生成器
   * @returns string - 随机查询词
   */
  private generateEnhancedRandomQuery(): string {
    // 扩展的查询词库，按类别组织，增加更多高质量的搜索词
    const queryCategories = {
      nature: [
        'mountain landscape', 'forest path', 'ocean waves', 'sunset sky', 
        'wildflowers', 'tall trees', 'wildlife photography', 'natural scenery',
        'peaceful lake', 'green meadow', 'rocky coastline', 'autumn leaves'
      ],
      people: [
        'professional portrait', 'business person', 'happy student', 'family together', 
        'friends laughing', 'professional headshot', 'lifestyle portrait', 'person working',
        'team collaboration', 'diverse group', 'confident professional', 'smiling person'
      ],
      business: [
        'modern office', 'business meeting', 'teamwork collaboration', 'professional presentation', 
        'contemporary workspace', 'innovative technology', 'business success', 'corporate environment',
        'conference room', 'business handshake', 'professional discussion', 'office interior'
      ],
      technology: [
        'modern computer', 'smartphone device', 'digital innovation', 'coding workspace', 
        'artificial intelligence', 'tech startup', 'digital transformation', 'modern technology',
        'laptop computer', 'digital screen', 'tech gadgets', 'innovation concept'
      ],
      food: [
        'fresh healthy food', 'gourmet cooking', 'restaurant dining', 'organic ingredients', 
        'delicious cuisine', 'food preparation', 'culinary art', 'nutritious meal',
        'farm fresh', 'cooking process', 'food styling', 'healthy eating'
      ],
      travel: [
        'urban cityscape', 'historic architecture', 'cultural landmark', 'travel adventure', 
        'vacation destination', 'world exploration', 'famous monuments', 'travel photography',
        'city streets', 'architectural details', 'tourist attraction', 'cultural heritage'
      ],
      art: [
        'creative artwork', 'modern design', 'artistic painting', 'sculpture art', 
        'art gallery', 'creative inspiration', 'artistic expression', 'design concept',
        'colorful art', 'abstract design', 'creative process', 'artistic creation'
      ],
      lifestyle: [
        'comfortable home', 'peaceful relaxation', 'wellness lifestyle', 'fitness activity', 
        'hobby enjoyment', 'leisure time', 'home comfort', 'daily routine',
        'work life balance', 'personal wellness', 'home interior', 'lifestyle choice'
      ]
    };
    
    // 随机选择类别
    const categories = Object.keys(queryCategories);
    const randomCategory = categories[randomGenerator.nextInt(0, categories.length - 1)];
    
    // 从选中类别中随机选择查询词
    const categoryQueries = queryCategories[randomCategory as keyof typeof queryCategories];
    const randomQuery = categoryQueries[randomGenerator.nextInt(0, categoryQueries.length - 1)];
    
    console.log(`🎲 生成增强随机查询: "${randomQuery}" (类别: ${randomCategory})`);
    
    return randomQuery;
  }

  /**
   * 计算图片与搜索查询的相关性评分
   * @param photo - 图片对象
   * @param searchQuery - 搜索查询
   * @returns number - 相关性评分（0-1之间）
   */
  private calculateRelevanceScore(photo: any, searchQuery: string): number {
    let score = 0.4; // 降低基础评分，让其他因素更重要
    
    // 检查图片的alt文本和搜索查询的匹配度
    const altText = (photo.alt || '').toLowerCase();
    const queryWords = searchQuery.toLowerCase().split(/[\s,.-]+/).filter(word => word.length > 2);
    
    // 计算关键词匹配度（提高权重）
    let exactMatches = 0;
    let partialMatches = 0;
    
    queryWords.forEach(word => {
      if (altText.includes(word)) {
        exactMatches++;
      } else {
        // 检查部分匹配（词根匹配）
        const wordRoot = word.substring(0, Math.max(3, word.length - 2));
        if (altText.includes(wordRoot)) {
          partialMatches++;
        }
      }
    });
    
    // 精确匹配评分（权重更高）
    const exactMatchRatio = queryWords.length > 0 ? exactMatches / queryWords.length : 0;
    score += exactMatchRatio * 0.4;
    
    // 部分匹配评分
    const partialMatchRatio = queryWords.length > 0 ? partialMatches / queryWords.length : 0;
    score += partialMatchRatio * 0.15;
    
    // 图片质量评分（基于尺寸，提高权重）
    if (photo.width && photo.height) {
      const resolution = photo.width * photo.height;
      // 提高质量标准：以4K为最高标准，1080p为良好标准
      const qualityScore = Math.min(resolution / (3840 * 2160), 1) * 0.25;
      score += qualityScore;
      
      // 额外的高分辨率奖励
      if (resolution >= 1920 * 1080) {
        score += 0.1; // 1080p及以上额外奖励
      }
      if (resolution >= 2560 * 1440) {
        score += 0.05; // 2K额外奖励
      }
    }
    
    // 摄影师评分（知名摄影师的作品通常质量更高）
    if (photo.photographer && photo.photographer.length > 0) {
      score += 0.05;
    }
    
    // 确保评分在0-1范围内
    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * 验证 Pexels API 密钥的有效性
   * @returns Promise<boolean> - API 密钥是否有效
   */
  async validateApiKey(): Promise<boolean> {
    try {
      // 在测试环境中跳过格式验证
      if (process.env.NODE_ENV !== 'test' && !validatePexelsApiKey(environment.pexels.apiKey)) {
        console.error('❌ Pexels API 密钥格式无效');
        return false;
      }

      // 通过发送测试请求验证密钥有效性
      const response = await fetch(`${environment.pexels.baseUrl}/search?query=test&per_page=1`, {
        headers: {
          'Authorization': environment.pexels.apiKey
        }
      });

      if (response.status === 401) {
        console.error('❌ Pexels API 密钥无效或已过期');
        return false;
      }

      if (response.status === 429) {
        console.warn('⚠️ Pexels API 配额已达限制');
        return true; // 密钥有效，但配额已用完
      }

      if (!response.ok) {
        console.error(`❌ Pexels API 验证失败: ${response.status} ${response.statusText}`);
        return false;
      }

      console.log('✅ Pexels API 密钥验证成功');
      return true;
    } catch (error) {
      console.error('❌ API 密钥验证过程中发生错误:', error);
      return false;
    }
  }

  /**
   * 记录性能指标
   * @param metrics - 性能指标数据
   */
  private recordPerformanceMetrics(metrics: PerformanceMetrics): void {
    // 添加到历史记录
    this.performanceHistory.push(metrics);
    
    // 限制历史记录大小
    if (this.performanceHistory.length > this.MAX_PERFORMANCE_HISTORY) {
      this.performanceHistory.shift();
    }
    
    // 记录请求时间戳
    this.requestTimestamps.push(metrics.timestamp);
    if (this.requestTimestamps.length > this.MAX_TIMESTAMP_HISTORY) {
      this.requestTimestamps.shift();
    }
    
    // 更新性能统计
    this.updatePerformanceStats(metrics);
  }

  /**
   * 更新性能统计数据
   * @param metrics - 当前请求的性能指标
   */
  private updatePerformanceStats(metrics: PerformanceMetrics): void {
    const { responseTime, success, errorCode } = metrics;
    
    // 更新响应时间统计
    if (responseTime < this.apiUsageStats.performanceMetrics.fastestResponse) {
      this.apiUsageStats.performanceMetrics.fastestResponse = responseTime;
    }
    
    if (responseTime > this.apiUsageStats.performanceMetrics.slowestResponse) {
      this.apiUsageStats.performanceMetrics.slowestResponse = responseTime;
    }
    
    // 计算百分位数响应时间
    this.calculatePercentileResponseTimes();
    
    // 更新错误统计
    if (!success && errorCode) {
      this.apiUsageStats.errorBreakdown[errorCode] = 
        (this.apiUsageStats.errorBreakdown[errorCode] || 0) + 1;
    }
    
    // 更新请求频率统计
    this.updateRequestFrequencyStats();
  }

  /**
   * 计算百分位数响应时间
   */
  private calculatePercentileResponseTimes(): void {
    const responseTimes = this.performanceHistory
      .filter(m => m.success)
      .map(m => m.responseTime)
      .sort((a, b) => a - b);
    
    if (responseTimes.length === 0) return;
    
    const p95Index = Math.ceil(responseTimes.length * 0.95) - 1;
    const p99Index = Math.ceil(responseTimes.length * 0.99) - 1;
    
    this.apiUsageStats.performanceMetrics.p95ResponseTime = responseTimes[p95Index] || 0;
    this.apiUsageStats.performanceMetrics.p99ResponseTime = responseTimes[p99Index] || 0;
  }

  /**
   * 更新请求频率统计
   */
  private updateRequestFrequencyStats(): void {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    // 计算过去一小时的请求数
    this.apiUsageStats.requestsPerHour = this.requestTimestamps
      .filter(timestamp => timestamp > oneHourAgo).length;
    
    // 计算今天的请求数
    this.apiUsageStats.requestsToday = this.requestTimestamps
      .filter(timestamp => timestamp > oneDayAgo).length;
  }

  /**
   * 从响应头中提取配额信息
   * @param response - HTTP 响应对象
   */
  private extractQuotaInfo(response: Response): void {
    try {
      // Pexels API 配额信息通常在响应头中
      const rateLimitRemaining = response.headers.get('X-Ratelimit-Remaining');
      const rateLimitLimit = response.headers.get('X-Ratelimit-Limit');
      const rateLimitReset = response.headers.get('X-Ratelimit-Reset');
      
      if (rateLimitLimit) {
        this.apiUsageStats.quotaUsage.limit = parseInt(rateLimitLimit, 10);
      }
      
      if (rateLimitRemaining && rateLimitLimit) {
        const remaining = parseInt(rateLimitRemaining, 10);
        const limit = parseInt(rateLimitLimit, 10);
        this.apiUsageStats.quotaUsage.estimated = limit - remaining;
      }
      
      if (rateLimitReset) {
        this.apiUsageStats.quotaUsage.resetTime = parseInt(rateLimitReset, 10) * 1000;
      }
    } catch (error) {
      console.warn('⚠️ 无法解析配额信息:', error);
    }
  }

  /**
   * 获取 API 使用统计信息
   * @returns ApiUsageStats - API 使用统计
   */
  getApiUsageStats(): ApiUsageStats {
    // 更新实时统计
    this.updateRequestFrequencyStats();
    
    return { 
      ...this.apiUsageStats,
      // 深拷贝嵌套对象
      quotaUsage: { ...this.apiUsageStats.quotaUsage },
      errorBreakdown: { ...this.apiUsageStats.errorBreakdown },
      performanceMetrics: { ...this.apiUsageStats.performanceMetrics }
    };
  }

  /**
   * 获取详细的性能指标
   * @param limit - 返回的记录数限制
   * @returns PerformanceMetrics[] - 性能指标历史记录
   */
  getPerformanceMetrics(limit: number = 100): PerformanceMetrics[] {
    return this.performanceHistory
      .slice(-limit)
      .map(metric => ({ ...metric })); // 返回副本
  }

  /**
   * 获取配额使用情况
   * @returns 配额使用详情
   */
  getQuotaUsage(): {
    current: number;
    limit: number | null;
    percentage: number | null;
    resetTime: Date | null;
    estimatedDailyUsage: number;
    projectedMonthlyUsage: number;
  } {
    const { estimated, limit, resetTime } = this.apiUsageStats.quotaUsage;
    
    // 估算每日使用量
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const dailyRequests = this.requestTimestamps
      .filter(timestamp => timestamp > oneDayAgo).length;
    
    // 预测月度使用量
    const projectedMonthlyUsage = dailyRequests * 30;
    
    return {
      current: estimated,
      limit,
      percentage: limit ? (estimated / limit) * 100 : null,
      resetTime: resetTime ? new Date(resetTime) : null,
      estimatedDailyUsage: dailyRequests,
      projectedMonthlyUsage
    };
  }

  /**
   * 重置统计数据
   */
  resetStats(): void {
    this.apiUsageStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastRequestTime: 0,
      averageResponseTime: 0,
      requestsPerHour: 0,
      requestsToday: 0,
      quotaUsage: {
        estimated: 0,
        limit: null,
        resetTime: null
      },
      errorBreakdown: {},
      performanceMetrics: {
        fastestResponse: Infinity,
        slowestResponse: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0
      }
    };
    
    this.performanceHistory = [];
    this.requestTimestamps = [];
    
    console.log('📊 API 统计数据已重置');
  }

  /**
   * 检查错误是否可以重试
   * @param error - 错误对象
   * @returns boolean - 是否可以重试
   */
  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message || '';
    
    // 不可重试的错误类型
    const nonRetryableErrors = [
      '401', 'Unauthorized',  // API 密钥无效
      '403', 'quota',         // 配额超限
      '429', 'Too Many Requests', // 频率限制
      'No matching photos found'  // 没有找到图片
    ];
    
    return !nonRetryableErrors.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * 指数退避重试机制
   * @param operation - 要重试的操作
   * @param maxRetries - 最大重试次数
   * @param baseDelay - 基础延迟时间（毫秒）
   * @returns Promise<T> - 操作结果
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = environment.pexels.maxRetries,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // 检查是否为不可重试的错误
        if (!this.isRetryableError(lastError)) {
          console.warn(`⚠️ 遇到不可重试的错误，直接抛出:`, lastError.message);
          throw lastError;
        }
        
        // 如果是最后一次尝试，直接抛出错误
        if (attempt === maxRetries) {
          break;
        }

        // 计算延迟时间（指数退避）
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        
        console.warn(`⚠️ 请求失败，${delay}ms 后进行第 ${attempt + 2} 次尝试:`, error);
        
        // 等待指定时间后重试
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * 创建详细的错误信息
   * @param error - 原始错误
   * @param context - 错误上下文
   * @returns ImageApiError - 格式化的错误信息
   */
  private createDetailedError(error: any, context: string): ImageApiError {
    const errorMessage = error.message || '';
    
    // 检查 HTTP 状态码错误
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      return {
        error: 'API 密钥无效或已过期',
        code: 'API_KEY_INVALID',
        details: '请检查 PEXELS_API_KEY 环境变量是否正确配置。您可以在 https://www.pexels.com/api/ 获取新的 API 密钥。'
      };
    }

    if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
      return {
        error: 'API 请求频率超限',
        code: 'RATE_LIMITED',
        details: 'Pexels API 请求频率超过限制，请稍后再试。',
        retryAfter: 60 // 建议 60 秒后重试
      };
    }

    if (errorMessage.includes('403') || errorMessage.includes('quota')) {
      return {
        error: 'API 配额已用完',
        code: 'QUOTA_EXCEEDED',
        details: '本月 Pexels API 配额已用完，请升级您的 API 计划或等待下月重置。'
      };
    }

    if (errorMessage.includes('No matching photos found')) {
      return {
        error: '未找到匹配的图片',
        code: 'NO_IMAGES_FOUND',
        details: `搜索词 "${context}" 没有找到相关图片，请尝试使用更通用的搜索词。`
      };
    }

    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
      return {
        error: '网络连接错误',
        code: 'NETWORK_ERROR',
        details: '无法连接到 Pexels API，请检查网络连接或稍后重试。'
      };
    }

    return {
      error: '未知错误',
      code: 'UNKNOWN_ERROR',
      details: `处理图片请求时发生未知错误: ${errorMessage || '无详细信息'}`
    };
  }
  async findStockImage(context: string, sessionId?: string): Promise<StockPhotoResultType> {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.apiUsageStats.totalRequests++;

    try {
      // 首先验证 API 密钥（仅在首次使用或上次验证失败时）
      if (this.apiUsageStats.totalRequests === 1 || this.apiUsageStats.failedRequests > 0) {
        const isValidKey = await this.validateApiKey();
        if (!isValidKey) {
          const error = this.createDetailedError(new Error('API key validation failed'), context);
          this.apiUsageStats.failedRequests++;
          throw error;
        }
      }

      // 使用重试机制执行图片搜索
      const result = await this.retryWithBackoff(async () => {
        // 优化搜索查询以提高相关性
        const optimizedQuery = this.optimizeSearchQuery(context, sessionId);
        console.log('🔍 优化后的Pexels搜索查询:', optimizedQuery);
        
        // 使用更大的per_page值以获得更多选择
        const perPage = Math.min(environment.pexels.defaultPerPage * 2, 80); // 增加搜索结果数量
        
        // Get images from Pexels search API
        const response = await fetch(`${environment.pexels.baseUrl}/search?query=${encodeURIComponent(optimizedQuery)}&per_page=${perPage}&orientation=all`, {
          headers: {
            'Authorization': environment.pexels.apiKey
          }
        });

        // 提取配额信息
        this.extractQuotaInfo(response);

        // 处理不同的 HTTP 状态码
        if (response.status === 401) {
          throw new Error('401 Unauthorized');
        }
        
        if (response.status === 403) {
          throw new Error('403 quota exceeded');
        }
        
        if (response.status === 429) {
          throw new Error('429 Too Many Requests');
        }

        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Check if any photos were found
        if (!data.photos || data.photos.length === 0) {
          throw new Error('No matching photos found');
        }

        // 按质量和相关性预筛选图片
        const qualityFilteredPhotos = this.filterPhotosByQuality(data.photos, optimizedQuery);
        
        // 使用智能图片选择算法
        let selectedPhoto: any;
        let session: UserSession | undefined;
        
        if (sessionId) {
          session = this.getOrCreateUserSession(sessionId);
          selectedPhoto = this.intelligentImageSelection(qualityFilteredPhotos, session, optimizedQuery);
          
          // 计算相关性评分（基于搜索查询匹配度）
          const relevanceScore = this.calculateRelevanceScore(selectedPhoto, optimizedQuery);
          
          // 获取图片尺寸信息
          const dimensions = selectedPhoto.width && selectedPhoto.height 
            ? { width: selectedPhoto.width, height: selectedPhoto.height }
            : undefined;
          
          // 选择最佳质量的URL
          const bestQualityUrl = this.selectBestQualityUrl(selectedPhoto);
          
          // 更新图片使用记录
          this.updateImageUsageRecord(sessionId, bestQualityUrl, optimizedQuery, relevanceScore, dimensions);
          
          // 更新会话统计（在获取responseTime之前先计算）
          const currentTime = Date.now();
          const tempResponseTime = currentTime - startTime;
          sessionManager.updateSessionStats(sessionId, tempResponseTime, true, optimizedQuery);
          
          console.log(`📊 会话统计 - 总请求: ${session.requestCount}, 已使用图片: ${session.images.size}, 相关性评分: ${relevanceScore.toFixed(3)}`);
        } else {
          // 无会话ID时使用增强的随机选择，但仍然考虑质量
          const shuffledPhotos = randomGenerator.shuffle(qualityFilteredPhotos);
          selectedPhoto = shuffledPhotos[0];
          console.log(`🎲 无会话高质量随机选择: ${selectedPhoto.id}`);
        }
        
        // 生成增强的图片描述
        const enhancedDescriptions = this.generateEnhancedImageDescription(
          selectedPhoto, 
          optimizedQuery, 
          context
        );
        
        // 选择最佳质量的URL
        const bestQualityUrl = this.selectBestQualityUrl(selectedPhoto);
        
        // Generate ID
        const imageId = `pexels_${Date.now()}_${selectedPhoto.id}`;
        
        return {
          id: imageId,
          url: bestQualityUrl,
          alt_description: enhancedDescriptions.alt_description,
          description: enhancedDescriptions.description,
          prompt: optimizedQuery,
          source: 'pexels' as const
        };
      });

      // 更新成功统计
      const responseTime = Date.now() - startTime;
      this.apiUsageStats.successfulRequests++;
      this.apiUsageStats.lastRequestTime = Date.now();
      
      // 计算平均响应时间
      if (this.apiUsageStats.successfulRequests === 1) {
        this.apiUsageStats.averageResponseTime = responseTime;
      } else {
        this.apiUsageStats.averageResponseTime = 
          (this.apiUsageStats.averageResponseTime * (this.apiUsageStats.successfulRequests - 1) + responseTime) / 
          this.apiUsageStats.successfulRequests;
      }

      // 记录性能指标
      this.recordPerformanceMetrics({
        requestId,
        timestamp: startTime,
        responseTime,
        success: true,
        query: context,
        sessionId,
        cacheHit: false
      });

      console.log(`✅ 成功获取图片，响应时间: ${responseTime}ms (请求ID: ${requestId})`);
      return result;

    } catch (error) {
      // 更新失败统计
      this.apiUsageStats.failedRequests++;
      
      // 创建详细的错误信息
      const detailedError = this.createDetailedError(error, context);
      
      // 记录失败的性能指标
      const responseTime = Date.now() - startTime;
      this.recordPerformanceMetrics({
        requestId,
        timestamp: startTime,
        responseTime,
        success: false,
        errorCode: detailedError.code,
        query: context,
        sessionId
      });
      
      // 更新会话统计（如果有会话ID）
      if (sessionId) {
        sessionManager.updateSessionStats(sessionId, responseTime, false);
      }
      
      console.error(`❌ 获取图片失败 (请求ID: ${requestId}):`, detailedError);
      
      // 抛出格式化的错误
      const formattedError = new Error(detailedError.error);
      (formattedError as any).code = detailedError.code;
      (formattedError as any).details = detailedError.details;
      (formattedError as any).retryAfter = detailedError.retryAfter;
      
      throw formattedError;
    }
  }

  /**
   * 按质量和相关性过滤图片
   * @param photos - 原始图片数组
   * @param searchQuery - 搜索查询
   * @returns 过滤后的高质量图片数组
   */
  private filterPhotosByQuality(photos: any[], searchQuery: string): any[] {
    // 计算每张图片的综合评分
    const scoredPhotos = photos.map(photo => {
      let score = 0;
      
      // 分辨率评分（权重：40%）
      if (photo.width && photo.height) {
        const resolution = photo.width * photo.height;
        const resolutionScore = Math.min(resolution / (1920 * 1080), 1); // 以1080p为基准
        score += resolutionScore * 0.4;
        
        // 高分辨率奖励
        if (resolution >= 2560 * 1440) score += 0.1; // 2K奖励
        if (resolution >= 3840 * 2160) score += 0.1; // 4K奖励
      }
      
      // 相关性评分（权重：35%）
      const relevanceScore = this.calculateRelevanceScore(photo, searchQuery);
      score += relevanceScore * 0.35;
      
      // 图片比例评分（权重：15%）
      if (photo.width && photo.height) {
        const aspectRatio = photo.width / photo.height;
        // 偏好常见的比例：16:9, 4:3, 3:2, 1:1
        const preferredRatios = [16/9, 4/3, 3/2, 1];
        const ratioScore = Math.max(...preferredRatios.map(ratio => 
          1 - Math.abs(aspectRatio - ratio) / ratio
        ));
        score += Math.max(ratioScore, 0) * 0.15;
      }
      
      // 摄影师信誉评分（权重：10%）
      if (photo.photographer && photo.photographer.length > 0) {
        score += 0.1;
      }
      
      return { photo, score };
    });
    
    // 按评分排序
    scoredPhotos.sort((a, b) => b.score - a.score);
    
    // 返回评分最高的70%图片，确保质量的同时保持多样性
    const topPercentage = 0.7;
    const topCount = Math.max(Math.ceil(scoredPhotos.length * topPercentage), 5);
    const filteredPhotos = scoredPhotos.slice(0, topCount).map(item => item.photo);
    
    console.log(`🎯 质量过滤: ${photos.length} → ${filteredPhotos.length} 张高质量图片`);
    
    return filteredPhotos;
  }

  /**
   * 获取随机图片（支持可选的查询参数）
   * @param query - 可选的搜索查询
   * @param sessionId - 可选的会话ID
   * @returns Promise<StockPhotoResultType> - 随机图片结果
   */
  async findRandomImage(query?: string, sessionId?: string): Promise<StockPhotoResultType> {
    // 使用增强的随机查询生成器或优化用户提供的查询
    let searchQuery: string;
    
    if (query) {
      // 如果用户提供了查询，进行优化
      searchQuery = this.optimizeSearchQuery(query, sessionId);
      console.log(`🔍 用户查询优化: "${query}" → "${searchQuery}" ${sessionId ? `(会话: ${sessionId})` : '(无会话)'}`);
    } else {
      // 如果没有查询，生成增强的随机查询
      searchQuery = this.generateEnhancedRandomQuery();
      console.log(`🎲 随机图片搜索查询: "${searchQuery}" ${sessionId ? `(会话: ${sessionId})` : '(无会话)'}`);
    }
    
    return this.findStockImage(searchQuery, sessionId);
  }

  /**
   * 获取会话统计信息
   * @param sessionId - 会话ID
   * @returns 会话统计信息或null
   */
  getSessionStats(sessionId: string): ReturnType<typeof sessionManager.getSessionDetails> {
    return sessionManager.getSessionDetails(sessionId);
  }

  /**
   * 清理指定会话的数据
   * @param sessionId - 会话ID
   * @returns boolean - 是否成功清理
   */
  clearSession(sessionId: string): boolean {
    return sessionManager.clearSession(sessionId, 'manual_request');
  }

  /**
   * 获取全局统计信息
   * @returns 全局统计信息
   */
  getGlobalStats(): ReturnType<typeof sessionManager.getGlobalStats> {
    return sessionManager.getGlobalStats();
  }

}

export const stockPhotoService = new StockPhotoService();