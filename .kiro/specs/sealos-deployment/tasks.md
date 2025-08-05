# Implementation Plan

- [x] 1. 环境依赖检查和安装
  - Node.js 20 已安装在 devbox 环境中
  - npm 已可用并为最新版本
  - 项目依赖已通过 package.json 定义
  - _Requirements: 1.1, 2.1_

- [x] 2. 数据库连接配置和验证
  - [x] 2.1 测试 Sealos 托管 MongoDB 连接
    - 验证从 devbox 环境连接到 wordpecker-db-mongodb.ns-t1zw83xe.svc:27017
    - 测试认证凭据 root/td6szbxh 是否有效
    - 验证网络连通性和数据库访问权限
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 2.2 创建数据库连接测试脚本
    - 编写独立的数据库连接测试脚本
    - 验证 CRUD 操作和数据持久化
    - 测试连接池和错误处理机制
    - _Requirements: 3.2, 3.4_

- [x] 3. 后端服务 Sealos 适配
  - [x] 3.1 创建 Sealos 环境配置文件
    - 创建 backend/.env 文件，配置 Sealos MongoDB 连接字符串
    - 配置环境变量: NODE_ENV=production, PORT=3000
    - 设置 MONGODB_URL=mongodb://root:td6szbxh@wordpecker-db-mongodb.ns-t1zw83xe.svc:27017/wordpecker
    - 配置必需的 OPENAI_API_KEY 和可选的 API 密钥
    - _Requirements: 2.1, 2.2, 2.3, 3.1_

  - [x] 3.2 实现健康检查端点
    - 在后端添加 /api/health 端点用于服务健康检查
    - 添加 /api/ready 端点用于就绪状态检查
    - 实现数据库连接状态检查
    - 验证 API 密钥配置状态
    - _Requirements: 1.2, 5.2_

  - [x] 3.3 配置后端监听所有网络接口
    - 修改 Express.js 服务监听 0.0.0.0:3000 而非 localhost:3000
    - 确保服务可从外部网络访问
    - 测试内网访问 (10.108.38.66:3000)
    - _Requirements: 1.2, 4.1_

- [x] 4. 前端服务 Sealos 适配
  - [x] 4.1 创建前端 Sealos 环境配置
    - 创建 frontend/.env 文件
    - 配置 VITE_API_URL 指向内网后端服务 (http://10.108.38.66:3000)
    - 或配置为 localhost:3000 用于同机部署
    - _Requirements: 4.1, 4.3_

  - [x] 4.2 验证 Vite 开发服务器网络配置
    - 确认 Vite 配置支持 host: true (0.0.0.0) 参数
    - 验证前端服务可监听所有网络接口 (端口 8080)
    - 配置 allowedHosts: 'all' 支持 Sealos 域名访问
    - _Requirements: 4.1, 4.2_

- [x] 5. 服务启动和集成测试
  - [x] 5.1 后端服务启动测试
    - 在 devbox 环境中启动后端服务
    - 验证数据库连接成功
    - 测试健康检查端点响应
    - 验证 API 端点可正常访问
    - _Requirements: 1.2, 1.3, 2.4_

  - [x] 5.2 前端服务启动测试
    - 在 devbox 环境中启动前端开发服务器
    - 验证前端页面可正常加载
    - 测试前后端 API 通信
    - 验证数据获取和显示功能
    - _Requirements: 1.1, 4.1, 4.3_

  - [x] 5.3 公网访问验证
    - 通过 Sealos 域名访问前端服务
    - 验证 Sealos 端口转发配置正常
    - 测试完整的用户访问流程
    - 确认前端可正常调用后端 API
    - 已创建 test-sealos-public-access.sh 脚本进行验证
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 6. 应用功能完整性验证
  - [x] 6.1 核心功能端到端测试
    - 测试词汇列表创建和管理功能
    - 验证 OpenAI API 集成 (词汇生成、定义、例句)
    - 测试语音对话功能 (OpenAI Realtime API)
    - 验证图像描述功能
    - 已创建 test-core-functionality.sh 脚本进行验证
    - _Requirements: 1.2, 2.1_

  - [x] 6.2 可选功能测试 (如已配置)
    - 测试 ElevenLabs 语音合成功能
    - 验证 Pexels 图像搜索功能
    - 测试音频播放和缓存功能
    - 已实现 testOptionalFeatures.ts 脚本进行验证
    - _Requirements: 2.2, 2.3_

- [ ] 7. 生产环境优化
  - [ ] 7.1 创建启动脚本
    - 编写后端服务启动脚本 (scripts/start-backend.sh)
    - 编写前端服务启动脚本 (scripts/start-frontend.sh)
    - 创建完整应用启动脚本 (scripts/start-app.sh)
    - 添加服务停止和重启脚本
    - _Requirements: 5.1, 5.4_

  - [ ] 7.2 配置进程管理 (可选)
    - 使用 PM2 或 systemd 管理后端进程
    - 配置服务自动重启和故障恢复
    - 设置日志轮转和错误监控
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 7.3 创建部署文档
    - 编写详细的 Sealos 部署指南
    - 记录环境变量配置清单
    - 创建故障排查和维护文档
    - 文档化成本优化建议
    - _Requirements: 5.1, 5.4, 6.1, 6.2, 6.4_