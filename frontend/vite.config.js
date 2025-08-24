import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        // 监听所有网络接口，允许外部访问
        host: true, // 等同于 '0.0.0.0'
        port: 8080,
        // 启用 CORS 支持
        cors: true,
        // 强制使用指定端口，不自动切换
        strictPort: true,
        // 禁用 Host 检查，允许所有域名访问
        // 允许 Sealos 分配的域名访问
        allowedHosts: true,
    },
});
