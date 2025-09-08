const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = 8080;
const BACKEND_PORT = 3000;

// 1. API代理中间件 - 启用详细日志
const apiProxyOptions = {
  target: `http://localhost:${BACKEND_PORT}`,
  changeOrigin: true,
  logLevel: 'debug',
  onError: (err, req, res) => {
    console.error('❌ Proxy error:', err.message);
    res.status(500).json({ 
      error: 'API proxy error', 
      message: err.message 
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 [PROXY] ${req.method} ${req.url} -> ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ [PROXY] Response ${proxyRes.statusCode} for ${req.method} ${req.url}`);
  }
};

app.use('/api', createProxyMiddleware(apiProxyOptions));

// 2. 静态文件服务
const staticPath = path.join(__dirname, 'frontend', 'dist');
console.log('📁 静态文件路径:', staticPath);

const fs = require('fs');
if (!fs.existsSync(staticPath)) {
  console.error('❌ 前端构建产物不存在:', staticPath);
  console.log('请先运行: cd frontend && npm run build');
  process.exit(1);
}

app.use(express.static(staticPath));

// 3. 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    frontend: 'serving',
    backend: `proxying to localhost:${BACKEND_PORT}`
  });
});

// 4. SPA路由支持 - 处理所有非API、非静态文件的请求
app.use((req, res, next) => {
  // 对于所有其他请求，返回index.html用于SPA路由
  console.log(`📄 [SPA] Serving index.html for ${req.method} ${req.url}`);
  const indexPath = path.join(staticPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('💥 发送index.html失败:', err);
      res.status(500).json({ 
        error: '页面加载失败',
        details: err.message
      });
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 WordPecker 全栈服务器已启动!');
  console.log(`📱 前端应用: http://0.0.0.0:${PORT}`);
  console.log(`🔌 API代理: http://0.0.0.0:${PORT}/api/* -> http://localhost:${BACKEND_PORT}/api/*`);
  console.log(`🏥 健康检查: http://0.0.0.0:${PORT}/health`);
  console.log(`📝 访问应用: https://jcmbvamxnlie.sealosbja.site:${PORT}`);
});
