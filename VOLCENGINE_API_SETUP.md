# 火山引擎 API 配置指南

本项目已集成火山引擎的豆包1.6、SeeDream 3.0以及语音合成服务，所有服务共用统一的 Access Key 认证。

## 🔑 API 密钥配置

### 1. 获取火山引擎 Access Key

1. 访问 [火山引擎控制台](https://console.volcengine.com/)
2. 登录账户并完成实名认证
3. 在右上角用户头像处选择"访问控制"
4. 点击"访问密钥"，创建新的 Access Key
5. 记录下 Access Key ID 和 Secret Access Key

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入以下配置：

```bash
# 火山引擎统一认证（必需）
VOLCENGINE_ACCESS_KEY_ID=你的_Access_Key_ID
VOLCENGINE_SECRET_ACCESS_KEY=你的_Secret_Access_Key

# 豆包1.6模型端点（必需）
DOUBAO_ENDPOINT=你的_豆包端点ID

# 火山引擎TTS应用ID（必需）
VOLCENGINE_APP_ID=你的_TTS应用ID
```

## 🚀 服务配置

### 豆包1.6文本生成

1. 在火山引擎控制台进入"人工智能" > "机器学习平台"
2. 创建豆包模型实例
3. 获取端点ID，配置为 `DOUBAO_ENDPOINT`

### 火山引擎TTS语音合成

1. 在火山引擎控制台进入"智能语音交互"
2. 创建TTS应用
3. 获取应用ID，配置为 `VOLCENGINE_APP_ID`

### SeeDream 3.0图像生成

使用统一的 Access Key 即可，无需额外配置。

## 🔧 快速测试

### 1. 验证配置

```bash
cd backend
npm run verify:volcengine-config
```

### 2. 测试API连接

```bash
npm run test:volcengine-api
```

## 📝 配置示例

以下是完整的环境变量配置示例：

```bash
# 基本配置
NODE_ENV=development
PORT=3000
MONGODB_URL=mongodb://localhost:27017/wordpecker

# 火山引擎认证
VOLCENGINE_ACCESS_KEY_ID=your_actual_access_key_id_here
VOLCENGINE_SECRET_ACCESS_KEY=your_actual_secret_access_key_here

# 豆包配置
DOUBAO_ENDPOINT=ep-20250824-xxxxx
DOUBAO_MODEL=doubao-pro-32k
DOUBAO_REGION=cn-beijing

# TTS配置
VOLCENGINE_APP_ID=6708d4e8-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VOLCENGINE_CLUSTER=volcano_tts
VOLCENGINE_VOICE_TYPE=BV700_streaming

# 图像生成配置
SEEDREAM_MODEL=seedream-3.0

# 服务优先级
AI_PROVIDER=doubao
VOICE_PROVIDER=volcengine
IMAGE_PROVIDER=seedream
```

## 🔍 配置验证

运行配置验证工具检查配置是否正确：

```bash
npm run verify:volcengine-config
```

预期输出：
```
🔑 Access Key 凭证检查:
✅ Access Key ID: AKLTZjVm...
✅ Secret Access Key: WmpobFlq...

🔍 服务配置验证:
✅ 豆包1.6: 配置完整
✅ 火山引擎TTS: 配置完整
✅ SeeDream 3.0: 配置完整

📊 配置状态总结:
   ✅ 完整配置: 3/3
   ⚠️  部分配置: 0/3
   ❌ 缺失配置: 0/3

🎉 所有服务配置验证通过！可以开始测试API连接。
```

## 🧪 API测试

运行 API 连接测试：

```bash
npm run test:volcengine-api
```

测试将验证：
- 豆包1.6文本生成
- 火山引擎TTS语音合成
- SeeDream 3.0图像生成

## 🔐 安全提醒

1. **不要提交敏感信息到Git**
   - `.env` 文件已添加到 `.gitignore`
   - API密钥不会被提交到GitHub

2. **定期轮换API密钥**
   - 建议定期更新Access Key
   - 及时撤销不再使用的密钥

3. **最小权限原则**
   - 只授予必要的API权限
   - 定期审查权限配置

## 🆘 故障排除

### 常见问题

1. **认证失败**
   ```
   错误：豆包API密钥未配置
   解决：检查VOLCENGINE_ACCESS_KEY_ID和VOLCENGINE_SECRET_ACCESS_KEY
   ```

2. **端点ID无效**
   ```
   错误：豆包端点ID未配置
   解决：在火山引擎控制台获取正确的端点ID
   ```

3. **TTS应用ID错误**
   ```
   错误：火山引擎应用ID未配置
   解决：检查VOLCENGINE_APP_ID配置
   ```

### 调试模式

启用详细日志：

```bash
NODE_ENV=development npm run test:volcengine-api
```

## 📞 技术支持

如遇问题，请：
1. 检查配置是否正确
2. 验证网络连接
3. 查看错误日志
4. 联系火山引擎技术支持

---

*配置完成后，项目将自动使用火山引擎服务，享受高性能的AI能力！*