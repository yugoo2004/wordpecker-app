import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { environment } from './config/environment';
import { errorHandler } from './middleware/errorHandler';
import { openaiRateLimiter } from './middleware/rateLimiter';
import { requestLogger, errorLogger, logContextMiddleware } from './middleware/loggerMiddleware';
import { logger } from './config/logger';
import { connectDB } from './config/mongodb';
import { configureOpenAIAgents } from './agents';

// Import routes
import healthRoutes from './api/health/routes';
import listRoutes from './api/lists/routes';
import wordRoutes from './api/words/routes';
import learnRoutes from './api/learn/routes';
import quizRoutes from './api/quiz/routes';
import templateRoutes from './api/templates/routes';
import preferencesRoutes from './api/preferences/routes';
import imageDescriptionRoutes from './api/image-description/routes';
import vocabularyRoutes from './api/vocabulary/routes';
import languageValidationRoutes from './api/language-validation/routes';
import audioRoutes from './api/audio/routes';
import voiceRoutes from './api/voice/routes';
import serviceStatusRoutes from './api/service-status';
import highAvailabilityRoutes from './api/high-availability/routes';
import managementRoutes from './api/management/routes';

const app = express();

// 信任代理（用于获取真实IP地址）
app.set('trust proxy', true);

// 日志中间件（在其他中间件之前）
app.use(requestLogger);
app.use(logContextMiddleware);

// Global middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Apply rate limiter only to OpenAI-powered routes
app.use('/api/learn', openaiRateLimiter);
app.use('/api/quiz', openaiRateLimiter);
app.use('/api/describe', openaiRateLimiter);
app.use('/api/vocabulary', openaiRateLimiter);
app.use('/api/language-validation', openaiRateLimiter);
app.use('/api/audio', openaiRateLimiter); // Audio routes use ElevenLabs API
app.use('/api/voice', openaiRateLimiter); // Voice routes use OpenAI Realtime API

// Routes
app.use('/api', healthRoutes); // 健康检查路由
app.use('/api/service', serviceStatusRoutes); // 服务状态监控路由
app.use('/api/lists', listRoutes);
app.use('/api/lists', wordRoutes);
app.use('/api/learn', learnRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/describe', imageDescriptionRoutes);
app.use('/api/vocabulary', vocabularyRoutes);
app.use('/api/language-validation', languageValidationRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/ha', highAvailabilityRoutes); // 高可用性管理API
app.use('/api/management', managementRoutes); // 远程管理API

// Error handling
app.use(errorLogger);
app.use(errorHandler);

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const PORT = environment.port;
  
  // Configure OpenAI agents and connect to MongoDB
  Promise.all([
    configureOpenAIAgents(),
    connectDB()
  ]).then(() => {
    // 监听所有网络接口 (0.0.0.0) 以支持 Sealos 部署
    app.listen(PORT, '0.0.0.0', () => {
      logger.info('Server started successfully', {
        port: PORT,
        host: '0.0.0.0',
        environment: environment.nodeEnv,
        endpoints: {
          health: `http://0.0.0.0:${PORT}/api/health`,
          ready: `http://0.0.0.0:${PORT}/api/ready`
        }
      });
      
      // 保留控制台输出用于PM2监控
      console.log(`Server running on 0.0.0.0:${PORT} in ${environment.nodeEnv} mode`);
      console.log(`Health check available at: http://0.0.0.0:${PORT}/api/health`);
      console.log(`Ready check available at: http://0.0.0.0:${PORT}/api/ready`);
    });
  }).catch(error => {
    logger.error('Failed to initialize application', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
    console.error('Failed to initialize application:', error);
    process.exit(1);
  });
}

export default app; 