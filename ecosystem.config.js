// PM2 进程管理配置文件 - 增强版
// 用于在 Sealos devbox 环境中管理 WordPecker 应用进程
// 支持生产环境优化、自动重启策略和详细监控

module.exports = {
  apps: [
    {
      // 后端应用配置 - 支持cluster模式和自动扩缩容
      name: 'wordpecker-backend',
      script: 'npm',
      args: 'start',
      cwd: './backend',
      instances: 2, // 限制为2个实例，避免端口冲突
      exec_mode: 'cluster', // 启用cluster模式支持负载均衡
      
      // 生产环境配置
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // 性能优化
        NODE_OPTIONS: '--max-old-space-size=512',
        // 日志级别
        LOG_LEVEL: 'info'
      },
      
      // 开发环境配置
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        LOG_LEVEL: 'debug'
      },
      
      // 自动重启策略配置
      autorestart: true,
      watch: false, // 生产环境禁用文件监听以提高性能
      max_memory_restart: '500M', // 内存限制保护
      min_uptime: '10s', // 最小运行时间，避免快速重启循环
      max_restarts: 3, // 降低最大重启次数，避免无限重启
      restart_delay: 4000, // 重启延迟（毫秒）
      
      // 进程监控和健康检查
      health_check_grace_period: 3000, // 健康检查宽限期
      kill_timeout: 5000, // 进程终止超时
      listen_timeout: 3000, // 监听超时
      
      // 详细日志管理配置
      log_file: './logs/pm2-backend-combined.log',
      out_file: './logs/pm2-backend-out.log',
      error_file: './logs/pm2-backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json', // 结构化日志输出
      
      // 日志轮转配置
      max_size: '10M', // 单个日志文件最大大小
      retain: 5, // 保留的日志文件数量
      compress: true, // 压缩旧日志文件
      dateFormat: 'YYYY-MM-DD_HH-mm-ss', // 日志文件时间戳格式
      
      // 进程监控参数
      monitoring: {
        http: true, // 启用HTTP监控
        https: false,
        port: 3000 // 监控端口
      },
      
      // 错误处理和恢复策略
      exp_backoff_restart_delay: 100, // 指数退避重启延迟基数
      
      // 忽略的监听文件（如果开启 watch）
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log',
        '.git',
        'audio-cache',
        'dist'
      ],
      
      // 环境变量文件
      env_file: './backend/.env',
      
      // 进程标识和描述
      pid_file: './logs/wordpecker-backend.pid',
      
      // 资源限制
      max_memory_restart: '500M',
      
      // 集群模式配置
      instance_var: 'INSTANCE_ID',
      
      // 负载均衡配置
      load_balancing: {
        // 启用负载均衡
        enabled: true,
        // 负载均衡算法：round_robin, least_conn, ip_hash
        algorithm: 'round_robin'
      },
      
      // 集群扩缩容配置
      scaling: {
        // 最小实例数
        min_instances: 1,
        // 最大实例数
        max_instances: 4,
        // CPU阈值触发扩容
        cpu_threshold: 80,
        // 内存阈值触发扩容
        memory_threshold: 80,
        // 扩缩容冷却时间（秒）
        cooldown: 60
      },
      
      // 健康检查配置
      health_check: {
        // 健康检查URL
        url: 'http://localhost:3000/api/health',
        // 检查间隔（秒）
        interval: 30,
        // 超时时间（毫秒）
        timeout: 5000,
        // 失败重试次数
        retries: 3
      }
    },
    
    {
      // 前端应用配置（开发模式）
      name: 'wordpecker-frontend-dev',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 5173',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      
      // 开发环境配置
      env_development: {
        NODE_ENV: 'development',
        PORT: 5173,
        VITE_API_URL: 'http://localhost:3000'
      },
      
      // 自动重启策略
      autorestart: true,
      watch: false, // 开发模式也禁用watch以提高稳定性
      max_memory_restart: '300M',
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      
      // 健康检查和监控
      health_check_grace_period: 3000,
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // 详细日志配置
      log_file: './logs/pm2-frontend-dev-combined.log',
      out_file: './logs/pm2-frontend-dev-out.log',
      error_file: './logs/pm2-frontend-dev-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json',
      
      // 日志轮转
      max_size: '5M',
      retain: 3,
      compress: true,
      
      // 进程标识
      pid_file: './logs/wordpecker-frontend-dev.pid',
      
      // 忽略的监听文件
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log',
        '.git',
        'dist',
        'build'
      ]
    },
    
    {
      // 前端应用配置（生产模式）
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
        VITE_API_URL: 'http://localhost:3000',
        // 性能优化
        NODE_OPTIONS: '--max-old-space-size=256'
      },
      
      // 自动重启策略配置
      autorestart: true,
      watch: false,
      max_memory_restart: '200M', // 前端内存限制更小
      min_uptime: '10s',
      max_restarts: 5, // 前端重启次数限制更严格
      restart_delay: 4000,
      
      // 进程监控和健康检查
      health_check_grace_period: 3000,
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // 详细日志管理
      log_file: './logs/pm2-frontend-combined.log',
      out_file: './logs/pm2-frontend-out.log',
      error_file: './logs/pm2-frontend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json',
      
      // 日志轮转配置
      max_size: '5M', // 前端日志文件更小
      retain: 3,
      compress: true,
      dateFormat: 'YYYY-MM-DD_HH-mm-ss',
      
      // 进程监控参数
      monitoring: {
        http: true,
        https: false,
        port: 5173
      },
      
      // 错误处理
      exp_backoff_restart_delay: 100,
      
      // 进程标识
      pid_file: './logs/wordpecker-frontend.pid',
      
      // 环境变量文件
      env_file: './frontend/.env',
      
      // 忽略的监听文件
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log',
        '.git',
        'dist',
        'build',
        'src' // 生产模式不监听源码变化
      ]
    }
  ],
  
  // 部署配置
  deploy: {
    production: {
      user: 'devbox',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:username/wordpecker.git',
      path: '/home/devbox/wordpecker-app',
      'pre-deploy-local': 'echo "开始部署到生产环境"',
      'post-deploy': [
        'echo "安装后端依赖"',
        'cd backend && npm ci --production',
        'echo "构建前端应用"', 
        'cd ../frontend && npm ci && npm run build',
        'echo "创建必要目录"',
        'mkdir -p ../logs ../audio-cache',
        'echo "重新加载PM2配置"',
        'pm2 reload ecosystem.config.js --env production',
        'echo "等待服务启动"',
        'sleep 10',
        'echo "验证服务状态"',
        'pm2 status',
        'echo "部署完成"'
      ].join(' && '),
      'pre-setup': [
        'echo "准备部署环境"',
        'sudo apt update',
        'curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -',
        'sudo apt-get install -y nodejs',
        'sudo npm install -g pm2',
        'pm2 install pm2-logrotate'
      ].join(' && ')
    }
  },
  
  // PM2 全局配置
  pmx: false, // 禁用PMX监控以节省资源
  
  // 日志轮转全局配置
  log_rotate: {
    max_size: '10M',
    retain: 5,
    compress: true,
    dateFormat: 'YYYY-MM-DD_HH-mm-ss',
    workerInterval: 30, // 每30秒检查一次日志大小
    rotateInterval: '0 0 * * *' // 每天午夜轮转日志
  },
  
  // 监控和告警配置
  monitoring: {
    // CPU使用率告警阈值
    cpu_threshold: 80,
    // 内存使用率告警阈值  
    memory_threshold: 80,
    // 重启次数告警阈值
    restart_threshold: 5,
    // 监控间隔（秒）
    check_interval: 60
  },
  
  // 错误处理策略
  error_handling: {
    // 启用错误日志聚合
    aggregate_errors: true,
    // 错误日志保留天数
    error_log_retention: 7,
    // 自动清理崩溃转储文件
    auto_cleanup_dumps: true
  }
};
