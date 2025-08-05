import { z } from 'zod';
import mongoose from 'mongoose';

export const startExerciseSchema = {
  body: z.object({
    context: z.string().optional(),
    imageSource: z.enum(['ai', 'stock']).default('ai')
  })
};

export const submitDescriptionSchema = {
  body: z.object({
    context: z.string().optional(),
    imageUrl: z.string().url(),
    imageAlt: z.string().optional(),
    userDescription: z.string().min(10)
  })
};

export const addWordsSchema = {
  body: z.object({
    exerciseId: z.string().refine(val => mongoose.Types.ObjectId.isValid(val), 'Invalid exercise ID'),
    listId: z.string().refine(val => mongoose.Types.ObjectId.isValid(val), 'Invalid list ID').optional(),
    selectedWords: z.array(z.object({
      word: z.string().min(1),
      meaning: z.string().min(1)
    })),
    createNewList: z.boolean().optional()
  })
};

export const historyQuerySchema = {
  query: z.object({
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('10')
  })
};

// 随机图片端点的验证模式
export const randomImageQuerySchema = {
  query: z.object({
    sessionId: z.string().optional(),
    query: z.string().optional()
  })
};

// 分类随机图片端点的验证模式
export const categoryRandomImageSchema = {
  params: z.object({
    category: z.string().min(1).max(50)
  }),
  query: z.object({
    sessionId: z.string().optional()
  })
};

// 性能指标端点的验证模式
export const metricsQuerySchema = {
  query: z.object({
    limit: z.string().transform(Number).pipe(z.number().min(1).max(1000)).optional()
  })
};

// 会话统计查询的验证模式
export const sessionStatsQuerySchema = {
  params: z.object({
    sessionId: z.string().min(1).max(100)
  })
};

// 会话管理的验证模式
export const sessionManagementSchema = {
  params: z.object({
    sessionId: z.string().min(1).max(100)
  }),
  body: z.object({
    action: z.enum(['clear', 'update_preferences']),
    preferences: z.object({
      categories: z.array(z.string()).optional(),
      excludeCategories: z.array(z.string()).optional(),
      minWidth: z.number().min(100).max(5000).optional(),
      minHeight: z.number().min(100).max(5000).optional(),
      qualityPreference: z.enum(['low', 'medium', 'high']).optional()
    }).optional()
  })
};