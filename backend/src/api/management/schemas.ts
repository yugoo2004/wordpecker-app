import { z } from 'zod';

// 服务操作相关schemas
export const ServiceActionSchema = z.object({
  service: z.enum(['wordpecker-backend', 'wordpecker-frontend', 'all']).optional().default('all')
});

export const ScaleServiceSchema = z.object({
  service: z.enum(['wordpecker-backend', 'wordpecker-frontend']),
  instances: z.coerce.number().min(1).max(5)
});

// 日志查询相关schemas
export const LogQuerySchema = z.object({
  service: z.string().optional(),
  lines: z.coerce.number().min(1).max(1000).optional().default(100),
  level: z.enum(['error', 'warn', 'info', 'debug']).optional()
});

export const LogCleanupSchema = z.object({
  days: z.coerce.number().min(1).max(30).optional().default(7)
});

// 响应类型定义
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  details?: any;
}

export interface ServiceStatus {
  name: string;
  status: 'online' | 'stopped' | 'stopping' | 'waiting restart' | 'launching' | 'errored' | 'one-launch-status';
  uptime: number;
  memory: number;
  cpu: number;
  restarts: number;
  pid: number;
  instances: number;
  exec_mode: 'fork' | 'cluster';
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: string;
    used: string;
    available: string;
    percentage: string;
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
  };
  load: {
    '1min': number;
    '5min': number;
    '15min': number;
  };
  uptime: number;
  timestamp: string;
}

export interface LogFile {
  name: string;
  size: number;
  modified: Date;
  path: string;
}

export interface LogEntry {
  type: 'log' | 'error' | 'connected' | 'heartbeat';
  service?: string;
  content?: string;
  timestamp: string;
}

// 操作结果类型
export interface OperationResult {
  success: boolean;
  message: string;
  timestamp: string;
  details?: {
    stdout: string;
    stderr: string;
  };
}

// 部署相关schemas（为未来扩展预留）
export const DeploymentSchema = z.object({
  version: z.string().optional(),
  branch: z.string().optional().default('main'),
  force: z.boolean().optional().default(false)
});

export interface DeploymentResult extends OperationResult {
  version?: string;
  rollback?: boolean;
}

// 导出类型推断
export type ServiceActionInput = z.infer<typeof ServiceActionSchema>;
export type ScaleServiceInput = z.infer<typeof ScaleServiceSchema>;
export type LogQueryInput = z.infer<typeof LogQuerySchema>;
export type LogCleanupInput = z.infer<typeof LogCleanupSchema>;
export type DeploymentInput = z.infer<typeof DeploymentSchema>;