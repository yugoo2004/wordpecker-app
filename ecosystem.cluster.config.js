// PM2 集群模式配置文件 - 高可用性版本
// 专门用于生产环境的高可用性部署，支持自动扩缩容和负载均衡

module.exports = {
  apps: [
    {
      // 后端应用 - 集群模式配置
      name: 'wordpecker-backend',
      script: 'npm',
      args: 'start',
      cwd: './backend',
      
      // 集群模式配置
      instances: 'max', // 使用所有可用CPU核心
      exec_mode: 'cluster', // 启用集群模式
      
      // 生产环境配置
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // 集群实例标识
        INSTANCE_ID: process.env.pm_id || 0,
        // 性能优化
        NODE_OPTIONS: '--max-old-space-size=512 --optimize-for-size',
        // 日志级别
        LOG_LEVEL: 'info',
        // 集群配置
        CLUSTER_MODE: 'true'
      },
      
      // 自动重启和监控配置
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 15, // 集群模式允许更多重启次数
      restart_delay: 2000, // 集群模式更快重启
      
      // 集群特定配置
      kill_timeout: 5000,
      listen_timeout: 3000,
      wait_ready: true, // 等待应用就绪信号
      ready_timeout: 10000, // 就绪超时时间
      
      // 负载均衡配置
      instance_var: 'INSTANCE_ID',
      
      // 日志配置 - 集群模式
      log_file: './logs/cluster-backend-combined.log',
      out_file: './logs/cluster-backend-out.log',
      error_file: './logs/cluster-backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json',
      
      // 日志轮转
      max_size: '20M', // 集群模式日志更大
      retain: 10,
      compress: true,
      
      // 健康检查配置
      health_check_grace_period: 5000,
      
      // 集群扩缩容配置
      scaling: {
        min_instances: 1,
        max_instances: 8, // 最大8个实例
        cpu_threshold: 75, // CPU阈值
        memory_threshold: 75, // 内存阈值
        scale_up_cooldown: 60, // 扩容冷却时间（秒）
        scale_down_cooldown: 120 // 缩容冷却时间（秒）
      },
      
      // 进程监控
      monitoring: {
        http: true,
        https: false,
        port: 3000,
        path: '/api/health'
      },
      
      // 错误处理
      exp_backoff_restart_delay: 100,
      
      // 忽略文件
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log',
        '.git',
        'audio-cache',
        'dist'
      ]
    },
    
    {
      // 前端应用 - 生产模式
      name: 'wordpecker-frontend',
      script: 'npm',
      args: 'run preview -- --host 0.0.0.0 --port 5173',
      cwd: './frontend',
      instances: 2, // 前端使用固定2个实例
      exec_mode: 'cluster',
      
      // 生产环境配置
      env: {
        NODE_ENV: 'production',
        PORT: 5173,
        VITE_API_URL: 'http://localhost:3000',
        NODE_OPTIONS: '--max-old-space-size=256',
        INSTANCE_ID: process.env.pm_id || 0
      },
      
      // 自动重启配置
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,
      
      // 集群配置
      kill_timeout: 5000,
      listen_timeout: 3000,
      wait_ready: false, // 前端不需要等待就绪信号
      
      // 负载均衡
      instance_var: 'INSTANCE_ID',
      
      // 日志配置
      log_file: './logs/cluster-frontend-combined.log',
      out_file: './logs/cluster-frontend-out.log',
      error_file: './logs/cluster-frontend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json',
      
      // 日志轮转
      max_size: '10M',
      retain: 5,
      compress: true,
      
      // 健康检查
      health_check_grace_period: 3000,
      
      // 监控配置
      monitoring: {
        http: true,
        https: false,
        port: 5173
      },
      
      // 错误处理
      exp_backoff_restart_delay: 100
    }
  ],
  
  // 部署配置 - 集群模式
  deploy: {
    production_cluster: {
      user: 'devbox',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:username/wordpecker.git',
      path: '/home/devbox/wordpecker-app',
      'pre-deploy-local': 'echo "开始集群模式部署"',
      'post-deploy': [
        'echo "安装后端依赖"',
        'cd backend && npm ci --production',
        'echo "构建前端应用"',
        'cd ../frontend && npm ci && npm run build',
        'echo "创建必要目录"',
        'mkdir -p ../logs ../audio-cache',
        'echo "启动集群模式"',
        'pm2 start ecosystem.cluster.config.js --env production',
        'echo "等待集群启动"',
        'sleep 15',
        'echo "验证集群状态"',
        'pm2 status',
        'echo "启动高可用性管理"',
        '../scripts/start-high-availability.sh',
        'echo "集群部署完成"'
      ].join(' && ')
    }
  },
  
  // 集群全局配置
  cluster: {
    // 负载均衡算法
    load_balancing: 'round_robin', // round_robin, least_conn, ip_hash
    
    // 健康检查配置
    health_check: {
      enabled: true,
      interval: 30000, // 30秒检查一次
      timeout: 5000,
      retries: 3,
      path: '/api/health'
    },
    
    // 自动扩缩容配置
    auto_scaling: {
      enabled: true,
      check_interval: 60000, // 1分钟检查一次
      cpu_threshold: {
        scale_up: 80,
        scale_down: 30
      },
      memory_threshold: {
        scale_up: 80,
        scale_down: 30
      },
      cooldown: {
        scale_up: 60000, // 1分钟冷却
        scale_down: 120000 // 2分钟冷却
      }
    },
    
    // 故障切换配置
    failover: {
      enabled: true,
      max_restart_attempts: 5,
      restart_delay: 2000,
      health_check_failed_threshold: 3
    }
  },
  
  // 监控和日志配置
  monitoring: {
    // 系统监控
    system_monitoring: {
      enabled: true,
      interval: 30000,
      metrics: ['cpu', 'memory', 'disk', 'network']
    },
    
    // 应用监控
    app_monitoring: {
      enabled: true,
      interval: 15000,
      endpoints: [
        'http://localhost:3000/api/health',
        'http://localhost:5173'
      ]
    },
    
    // 告警配置
    alerts: {
      cpu_threshold: 90,
      memory_threshold: 90,
      disk_threshold: 85,
      error_rate_threshold: 5, // 5%错误率
      response_time_threshold: 5000 // 5秒响应时间
    }
  },
  
  // 日志聚合配置
  logging: {
    // 集中日志配置
    centralized: true,
    
    // 日志轮转
    rotation: {
      max_size: '50M',
      max_files: 20,
      compress: true,
      interval: '1d' // 每天轮转
    },
    
    // 日志级别
    levels: {
      production: 'info',
      development: 'debug'
    },
    
    // 结构化日志
    structured: true,
    format: 'json'
  },
  
  // 性能优化配置
  performance: {
    // Node.js 优化
    node_options: {
      max_old_space_size: 512,
      optimize_for_size: true,
      gc_interval: 100
    },
    
    // PM2 优化
    pm2_options: {
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 15
    }
  }
};