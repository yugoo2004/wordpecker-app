// PM2 进程管理配置文件
// 用于在 Sealos devbox 环境中管理 WordPecker 应用进程

module.exports = {
  apps: [
    {
      // 后端应用配置
      name: 'wordpecker-backend',
      script: 'npm',
      args: 'start',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      
      // 环境变量
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      
      // 开发环境变量
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      
      // 自动重启配置
      autorestart: true,
      watch: false, // 生产环境不建议开启文件监听
      max_memory_restart: '500M',
      
      // 日志配置
      log_file: './logs/pm2-backend-combined.log',
      out_file: './logs/pm2-backend-out.log',
      error_file: './logs/pm2-backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // 进程管理
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // 健康检查
      health_check_grace_period: 3000,
      
      // 其他配置
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // 忽略的监听文件（如果开启 watch）
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log',
        '.git'
      ]
    },
    
    {
      // 前端应用配置（开发模式）
      name: 'wordpecker-frontend-dev',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 5173',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      
      // 环境变量
      env: {
        NODE_ENV: 'development',
        PORT: 5173,
        VITE_API_URL: 'http://localhost:3000'
      },
      
      // 自动重启配置
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      
      // 日志配置
      log_file: './logs/pm2-frontend-combined.log',
      out_file: './logs/pm2-frontend-out.log',
      error_file: './logs/pm2-frontend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // 进程管理
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      
      // 健康检查
      health_check_grace_period: 3000,
      
      // 其他配置
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // 忽略的监听文件
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log',
        '.git',
        'dist'
      ]
    },
    
    {
      // 前端应用配置（生产模式 - 预览）
      name: 'wordpecker-frontend-preview',
      script: 'npm',
      args: 'run preview -- --host 0.0.0.0 --port 5173',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      
      // 环境变量
      env: {
        NODE_ENV: 'production',
        PORT: 5173,
        VITE_API_URL: 'http://localhost:3000'
      },
      
      // 自动重启配置
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      
      // 日志配置
      log_file: './logs/pm2-frontend-preview-combined.log',
      out_file: './logs/pm2-frontend-preview-out.log',
      error_file: './logs/pm2-frontend-preview-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // 进程管理
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      
      // 其他配置
      kill_timeout: 5000,
      listen_timeout: 3000
    }
  ],
  
  // 部署配置（可选）
  deploy: {
    production: {
      user: 'devbox',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:username/wordpecker.git',
      path: '/home/devbox/project',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
};