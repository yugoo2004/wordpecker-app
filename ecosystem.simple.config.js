module.exports = {
  apps: [
    {
      name: 'wordpecker-backend',
      script: 'npm',
      args: 'start',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      log_file: './logs/pm2-backend-combined.log',
      out_file: './logs/pm2-backend-out.log',
      error_file: './logs/pm2-backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'wordpecker-frontend',
      script: 'npm',
      args: 'run preview -- --host 0.0.0.0 --port 5173',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5173
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      log_file: './logs/pm2-frontend-combined.log',
      out_file: './logs/pm2-frontend-out.log',
      error_file: './logs/pm2-frontend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};