module.exports = {
  apps: [
    {
      name: 'wordpecker-backend',
      script: 'npm',
      args: 'start',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      
      // 生产环境配置
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      
      // 自动重启和监控
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // 日志管理
      log_file: './logs/pm2-backend-combined.log',
      out_file: './logs/pm2-backend-out.log',
      error_file: './logs/pm2-backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // 进程保活
      kill_timeout: 5000,
      listen_timeout: 3000
    },
    
    {
      name: 'wordpecker-frontend',
      script: 'npm',
      args: 'run preview -- --host 0.0.0.0 --port 5173',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      
      // 生产环境配置
      env: {
        NODE_ENV: 'production',
        PORT: 5173,
        VITE_API_URL: 'http://localhost:3000'
      },
      
      // 自动重启配置
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      
      // 日志管理
      log_file: './logs/pm2-frontend-combined.log',
      out_file: './logs/pm2-frontend-out.log',
      error_file: './logs/pm2-frontend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};