import { createServer } from 'http';
import app from '../app';
import { environment } from '../config/environment';
import { connectDB } from '../config/mongodb';
import { configureOpenAIAgents } from '../agents';

async function testNetworkBinding() {
  console.log('🌐 测试网络接口绑定...');
  
  try {
    // 初始化应用依赖
    console.log('🔧 初始化应用依赖...');
    await Promise.all([
      configureOpenAIAgents(),
      connectDB()
    ]);
    console.log('✅ 应用依赖初始化完成');

    // 创建 HTTP 服务器并绑定到所有网络接口
    const server = createServer(app);
    const PORT = environment.port;
    
    console.log(`🚀 启动服务器，监听 0.0.0.0:${PORT}...`);
    
    server.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`✅ 服务器成功启动在 0.0.0.0:${PORT}`);
      console.log(`📊 健康检查端点: http://0.0.0.0:${PORT}/api/health`);
      console.log(`🚀 就绪检查端点: http://0.0.0.0:${PORT}/api/ready`);
      
      // 测试完成后关闭服务器
      setTimeout(() => {
        console.log('🔄 测试完成，关闭服务器...');
        server.close(() => {
          console.log('✅ 服务器已关闭');
          process.exit(0);
        });
      }, 3000);
    });

    server.on('error', (error) => {
      console.error('❌ 服务器启动失败:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ 初始化失败:', error);
    process.exit(1);
  }
}

testNetworkBinding();