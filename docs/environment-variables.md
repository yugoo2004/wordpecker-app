# WordPecker 环境变量配置清单

## 概述

本文档详细列出了 WordPecker 应用在 Sealos 环境中所需的所有环境变量配置，包括后端和前端的配置项、默认值、说明和示例。

## 目录

1. [后端环境变量](#后端环境变量)
2. [前端环境变量](#前端环境变量)
3. [PM2 环境变量](#pm2-环境变量)
4. [systemd 环境变量](#systemd-环境变量)
5. [配置验证](#配置验证)
6. [安全建议](#安全建议)

## 后端环境变量

### 文件位置
`backend/.env`

### 必需配置

#### 服务配置
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `NODE_ENV` | string | `development` | 运行环境 | `production`, `development`, `test` |
| `PORT` | number | `3000` | 服务监听端口 | `3000` |
| `HOST` | string | `localhost` | 服务监听地址 | `0.0.0.0`, `localhost` |

#### 数据库配置
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `MONGODB_URI` | string | **必需** | MongoDB 连接字符串 | `mongodb://user:pass@host:27017/db` |
| `DB_NAME` | string | `wordpecker` | 数据库名称 | `wordpecker` |
| `DB_CONNECTION_TIMEOUT` | number | `30000` | 连接超时时间(ms) | `30000` |
| `DB_MAX_POOL_SIZE` | number | `10` | 最大连接池大小 | `10` |

#### JWT 配置
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `JWT_SECRET` | string | **必需** | JWT 签名密钥 | `your-super-secret-jwt-key-here` |
| `JWT_EXPIRES_IN` | string | `7d` | JWT 过期时间 | `7d`, `24h`, `3600s` |
| `JWT_REFRESH_EXPIRES_IN` | string | `30d` | 刷新令牌过期时间 | `30d` |

### 可选配置

#### CORS 配置
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `CORS_ORIGIN` | string | `*` | 允许的跨域源 | `http://localhost:5173,http://101.126.5.123:5173` |
| `CORS_METHODS` | string | `GET,POST,PUT,DELETE,OPTIONS` | 允许的 HTTP 方法 | `GET,POST,PUT,DELETE` |
| `CORS_CREDENTIALS` | boolean | `true` | 是否允许携带凭证 | `true`, `false` |

#### 日志配置
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `LOG_LEVEL` | string | `info` | 日志级别 | `error`, `warn`, `info`, `debug` |
| `LOG_FILE` | string | `logs/app.log` | 日志文件路径 | `logs/app.log` |
| `LOG_MAX_SIZE` | string | `10m` | 单个日志文件最大大小 | `10m`, `100k` |
| `LOG_MAX_FILES` | number | `5` | 保留的日志文件数量 | `5` |

#### API 配置
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `API_PREFIX` | string | `/api` | API 路径前缀 | `/api`, `/v1` |
| `API_VERSION` | string | `v1` | API 版本 | `v1`, `v2` |
| `API_TIMEOUT` | number | `30000` | API 请求超时时间(ms) | `30000` |

#### 限流配置
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `RATE_LIMIT_WINDOW_MS` | number | `900000` | 限流时间窗口(ms) | `900000` (15分钟) |
| `RATE_LIMIT_MAX_REQUESTS` | number | `100` | 时间窗口内最大请求数 | `100` |
| `RATE_LIMIT_SKIP_SUCCESSFUL` | boolean | `false` | 是否跳过成功请求 | `true`, `false` |

#### 安全配置
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `BCRYPT_ROUNDS` | number | `12` | 密码哈希轮数 | `12` |
| `SESSION_SECRET` | string | **推荐设置** | 会话密钥 | `your-session-secret` |
| `CSRF_SECRET` | string | **推荐设置** | CSRF 保护密钥 | `your-csrf-secret` |

#### 文件上传配置
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `UPLOAD_MAX_SIZE` | string | `10mb` | 最大上传文件大小 | `10mb`, `5mb` |
| `UPLOAD_ALLOWED_TYPES` | string | `image/*,text/*` | 允许的文件类型 | `image/*,text/*` |
| `UPLOAD_DEST` | string | `uploads/` | 上传文件目录 | `uploads/` |

### 完整配置示例

```env
# 服务配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 数据库配置
MONGODB_URI=mongodb://wordpecker_user:your_password@mongodb-host:27017/wordpecker
DB_NAME=wordpecker
DB_CONNECTION_TIMEOUT=30000
DB_MAX_POOL_SIZE=10

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# CORS 配置
CORS_ORIGIN=http://101.126.5.123:5173,http://localhost:5173,http://10.108.38.66:5173
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_CREDENTIALS=true

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# API 配置
API_PREFIX=/api
API_VERSION=v1
API_TIMEOUT=30000

# 限流配置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_SKIP_SUCCESSFUL=false

# 安全配置
BCRYPT_ROUNDS=12
SESSION_SECRET=your-session-secret-change-this
CSRF_SECRET=your-csrf-secret-change-this

# 文件上传配置
UPLOAD_MAX_SIZE=10mb
UPLOAD_ALLOWED_TYPES=image/*,text/*,application/pdf
UPLOAD_DEST=uploads/
```

## 前端环境变量

### 文件位置
`frontend/.env`

### 必需配置

#### API 配置
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `VITE_API_URL` | string | **必需** | 后端 API 基础 URL | `http://101.126.5.123:3000` |
| `VITE_API_PREFIX` | string | `/api` | API 路径前缀 | `/api` |
| `VITE_API_VERSION` | string | `v1` | API 版本 | `v1` |

### 可选配置

#### 应用配置
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `VITE_APP_TITLE` | string | `WordPecker` | 应用标题 | `WordPecker` |
| `VITE_APP_VERSION` | string | `1.0.0` | 应用版本 | `1.0.0` |
| `VITE_APP_DESCRIPTION` | string | `AI Writing Assistant` | 应用描述 | `AI Writing Assistant` |

#### 开发服务器配置
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `VITE_DEV_SERVER_HOST` | string | `localhost` | 开发服务器地址 | `0.0.0.0` |
| `VITE_DEV_SERVER_PORT` | number | `5173` | 开发服务器端口 | `5173` |
| `VITE_DEV_SERVER_OPEN` | boolean | `false` | 是否自动打开浏览器 | `true`, `false` |

#### 构建配置
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `VITE_BUILD_OUTDIR` | string | `dist` | 构建输出目录 | `dist` |
| `VITE_BUILD_SOURCEMAP` | boolean | `false` | 是否生成源码映射 | `true`, `false` |
| `VITE_BUILD_MINIFY` | boolean | `true` | 是否压缩代码 | `true`, `false` |

#### 功能开关
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `VITE_ENABLE_PWA` | boolean | `false` | 是否启用 PWA | `true`, `false` |
| `VITE_ENABLE_ANALYTICS` | boolean | `false` | 是否启用分析 | `true`, `false` |
| `VITE_ENABLE_DEBUG` | boolean | `false` | 是否启用调试模式 | `true`, `false` |

#### 第三方服务配置
| 变量名 | 类型 | 默认值 | 说明 | 示例 |
|--------|------|--------|------|------|
| `VITE_GOOGLE_ANALYTICS_ID` | string | - | Google Analytics ID | `GA_MEASUREMENT_ID` |
| `VITE_SENTRY_DSN` | string | - | Sentry 错误监控 DSN | `https://...@sentry.io/...` |

### 完整配置示例

```env
# API 配置
VITE_API_URL=http://101.126.5.123:3000
VITE_API_PREFIX=/api
VITE_API_VERSION=v1

# 应用配置
VITE_APP_TITLE=WordPecker
VITE_APP_VERSION=1.0.0
VITE_APP_DESCRIPTION=AI Writing Assistant

# 开发服务器配置
VITE_DEV_SERVER_HOST=0.0.0.0
VITE_DEV_SERVER_PORT=5173
VITE_DEV_SERVER_OPEN=false

# 构建配置
VITE_BUILD_OUTDIR=dist
VITE_BUILD_SOURCEMAP=false
VITE_BUILD_MINIFY=true

# 功能开关
VITE_ENABLE_PWA=false
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=false

# 第三方服务配置（可选）
# VITE_GOOGLE_ANALYTICS_ID=GA_MEASUREMENT_ID
# VITE_SENTRY_DSN=https://...@sentry.io/...
```

## PM2 环境变量

### ecosystem.config.js 中的环境变量

```javascript
// 生产环境变量
env: {
  NODE_ENV: 'production',
  PORT: 3000,
  // 其他后端环境变量...
}

// 开发环境变量
env_development: {
  NODE_ENV: 'development',
  PORT: 3000,
  // 其他后端环境变量...
}
```

## systemd 环境变量

### 服务文件中的环境变量

```ini
[Service]
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=MONGODB_URI=mongodb://...
# 其他环境变量...
```

## 配置验证

### 后端配置验证脚本

```bash
#!/bin/bash
# scripts/validate-backend-env.sh

echo "验证后端环境变量配置..."

# 检查必需的环境变量
required_vars=(
    "MONGODB_URI"
    "JWT_SECRET"
)

missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "错误: 缺少必需的环境变量:"
    printf '%s\n' "${missing_vars[@]}"
    exit 1
fi

echo "✓ 所有必需的环境变量都已设置"

# 验证数据库连接
echo "验证数据库连接..."
cd backend && npx ts-node src/scripts/testMongoConnection.ts

echo "✓ 后端环境变量验证完成"
```

### 前端配置验证脚本

```bash
#!/bin/bash
# scripts/validate-frontend-env.sh

echo "验证前端环境变量配置..."

# 检查 API URL 是否可访问
if [ -n "$VITE_API_URL" ]; then
    echo "检查 API 连接: $VITE_API_URL"
    if curl -s "$VITE_API_URL/api/health" > /dev/null; then
        echo "✓ API 连接正常"
    else
        echo "⚠ API 连接失败，请检查后端服务"
    fi
else
    echo "⚠ VITE_API_URL 未设置"
fi

echo "✓ 前端环境变量验证完成"
```

### 使用验证脚本

```bash
# 创建验证脚本
chmod +x scripts/validate-backend-env.sh
chmod +x scripts/validate-frontend-env.sh

# 运行验证
./scripts/validate-backend-env.sh
./scripts/validate-frontend-env.sh
```

## 安全建议

### 1. 敏感信息保护

#### 必须更改的默认值
- `JWT_SECRET`: 使用强随机字符串
- `SESSION_SECRET`: 使用强随机字符串
- `CSRF_SECRET`: 使用强随机字符串
- 数据库密码: 使用复杂密码

#### 生成安全密钥
```bash
# 生成随机密钥
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. 环境隔离

#### 不同环境使用不同配置
- **开发环境**: 使用测试数据库和宽松的安全设置
- **生产环境**: 使用生产数据库和严格的安全设置
- **测试环境**: 使用独立的测试配置

### 3. 配置文件安全

#### .env 文件保护
```bash
# 设置适当的文件权限
chmod 600 backend/.env
chmod 600 frontend/.env

# 确保 .env 文件不被版本控制
echo "*.env" >> .gitignore
```

#### 环境变量检查清单
- [ ] 所有敏感信息都已设置为环境变量
- [ ] 没有硬编码的密码或密钥
- [ ] .env 文件已添加到 .gitignore
- [ ] 生产环境使用强密钥
- [ ] 数据库连接使用加密传输
- [ ] CORS 配置限制了允许的源

### 4. 定期安全检查

```bash
# 检查环境变量安全性
./scripts/security-check.sh

# 更新依赖包
npm audit
npm audit fix

# 检查敏感信息泄露
git log --grep="password\|secret\|key" --oneline
```

## 故障排查

### 常见配置问题

#### 1. 数据库连接失败
```bash
# 检查连接字符串格式
echo $MONGODB_URI

# 测试连接
mongo "$MONGODB_URI"
```

#### 2. CORS 错误
```bash
# 检查 CORS 配置
grep CORS_ORIGIN backend/.env

# 确保前端 URL 在允许列表中
```

#### 3. JWT 错误
```bash
# 检查 JWT 密钥是否设置
echo $JWT_SECRET | wc -c  # 应该 > 32 字符
```

#### 4. 前端无法连接后端
```bash
# 检查 API URL 配置
grep VITE_API_URL frontend/.env

# 测试 API 连接
curl $VITE_API_URL/api/health
```

### 配置调试工具

```bash
# 显示所有环境变量（注意安全）
env | grep -E "(NODE_ENV|PORT|MONGODB|JWT|VITE_)"

# 检查配置文件语法
node -c backend/.env  # 检查语法错误
```

## 总结

正确配置环境变量是 WordPecker 应用成功部署的关键。请确保：

1. **必需变量**: 所有必需的环境变量都已正确设置
2. **安全性**: 敏感信息使用强密钥并妥善保护
3. **环境隔离**: 不同环境使用不同的配置
4. **验证**: 定期验证配置的正确性
5. **文档**: 保持配置文档的更新

如有配置问题，请参考故障排查部分或使用提供的验证脚本进行诊断。