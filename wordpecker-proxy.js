const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = 8080;

console.log('🚀 启动清洁代理服务器...');

// 创建代理中间件 - 将 /api/* 转换为 /api/*
const apiProxy = createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  pathRewrite: {
    '^/': '/api/'  // 将任何路径前缀替换为 /api/
  },
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`代理请求: ${req.method} ${req.originalUrl} -> ${proxyReq.path}`);
  }
});

// API代理
app.use('/api', apiProxy);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), service: 'clean-proxy' });
});

// 静态文件
const staticPath = path.join(__dirname, 'frontend', 'dist');
console.log('静态文件路径:', staticPath);
app.use(express.static(staticPath));

// SPA路由 - 捕获所有非API和非健康检查的请求
app.use((req, res) => {
  if (req.path.startsWith('/api') || req.path === '/health') {
    res.status(404).send('Not Found');
    return;
  }
  res.sendFile(path.join(staticPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ 清洁代理服务器运行在端口 ${PORT}`);
  console.log(`📝 前端: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
});
