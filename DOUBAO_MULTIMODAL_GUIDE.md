# 豆包1.6多模态API客户端配置指南

## 概述

本指南介绍如何配置和使用WordPecker项目中集成的豆包1.6多模态API客户端。该客户端支持文本+图像的多模态输入，以及SeeDream 3.0图像生成功能。

## 功能特性

### ✅ 已实现功能

1. **豆包1.6多模态聊天**
   - 支持图像+文本输入
   - 图像分析和描述
   - 基于图像的词汇生成
   - 多模态测验题目生成

2. **SeeDream 3.0图像生成**
   - 高质量图像生成
   - 可调节引导强度（guidance_scale 1-10）
   - 多种图像尺寸支持
   - 水印控制

3. **故障转移机制**
   - 自动降级到其他AI服务
   - 服务状态监控
   - 错误重试机制

## 环境配置

### 必需的环境变量

```bash
# 豆包1.6模型配置（多模态文本生成）
DOUBAO_API_KEY=your_doubao_api_key_here
DOUBAO_ENDPOINT=your_doubao_endpoint_id_here  # 必需！

# 火山引擎认证（推荐，用于豆包和SeeDream 3.0）
VOLCENGINE_ACCESS_KEY_ID=your_access_key_id
VOLCENGINE_SECRET_ACCESS_KEY=your_secret_access_key

# SeeDream 3.0图像生成配置
SEEDREAM_API_KEY=your_seedream_api_key_here  # 或使用上面的火山引擎认证
```

### 可选的环境变量

```bash
# 豆包高级配置
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3  # 默认值
DOUBAO_MODEL=doubao-seed-1-6-250615  # 默认模型
DOUBAO_REGION=cn-beijing  # 默认区域
DOUBAO_MAX_RETRIES=3  # 重试次数
DOUBAO_TIMEOUT=30000  # 超时时间（毫秒）

# SeeDream 3.0高级配置
SEEDREAM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3  # 默认值
SEEDREAM_MODEL=doubao-seedream-3-0-t2i-250415  # 默认模型
SEEDREAM_DEFAULT_SIZE=1024x1024  # 默认图像尺寸
SEEDREAM_GUIDANCE_SCALE=3  # 默认引导强度
SEEDREAM_WATERMARK=true  # 是否添加水印
SEEDREAM_MAX_RETRIES=3  # 重试次数
SEEDREAM_TIMEOUT=60000  # 超时时间（毫秒）
```

## API端点

### 多模态分析端点

#### 1. 图像分析
```
POST /api/multimodal/analyze-image
```

**请求体示例：**
```json
{
  "imageUrl": "https://example.com/image.jpg",
  "prompt": "请分析这张图片并描述其主要内容。",
  "targetLanguage": "chinese",
  "analysisType": "description",
  "options": {
    "detail": "auto",
    "temperature": 0.3,
    "max_tokens": 1000
  }
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "analysis": {
      "description": "这是一张城市街景图片..."
    },
    "metadata": {
      "imageUrl": "https://example.com/image.jpg",
      "analysisType": "description",
      "targetLanguage": "chinese",
      "model": "doubao-seed-1-6-250615",
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    "usage": {
      "prompt_tokens": 120,
      "completion_tokens": 80,
      "total_tokens": 200
    }
  }
}
```

#### 2. 词汇生成
```
POST /api/multimodal/generate-vocabulary
```

**请求体示例：**
```json
{
  "imageUrl": "https://example.com/image.jpg",
  "targetLanguage": "english",
  "difficulty": "intermediate",
  "wordCount": 10,
  "includeExamples": true,
  "includePronunciation": false
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "description": "这是一张城市街景图片...",
    "vocabulary": [
      {
        "word": "skyscraper",
        "definition": "A very tall building",
        "partOfSpeech": "noun",
        "difficulty": "intermediate",
        "examples": ["The skyscraper dominates the city skyline"],
        "context": "在图片中的高楼大厦"
      }
    ],
    "metadata": {
      "imageUrl": "https://example.com/image.jpg",
      "targetLanguage": "english",
      "difficulty": "intermediate",
      "wordCount": 10
    },
    "usage": {
      "prompt_tokens": 150,
      "completion_tokens": 200,
      "total_tokens": 350
    }
  }
}
```

#### 3. 测验生成
```
POST /api/multimodal/generate-quiz
```

**请求体示例：**
```json
{
  "imageUrl": "https://example.com/image.jpg",
  "vocabulary": ["building", "street", "car", "people"],
  "questionCount": 5,
  "difficulty": "intermediate",
  "questionTypes": ["multiple_choice"]
}
```

#### 4. 多模态聊天
```
POST /api/multimodal/chat
```

**请求体示例：**
```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": "https://example.com/image.jpg",
            "detail": "auto"
          }
        },
        {
          "type": "text",
          "text": "请描述这张图片中的内容"
        }
      ]
    }
  ],
  "options": {
    "temperature": 0.7,
    "max_tokens": 1000
  }
}
```

### 图像生成端点

#### SeeDream 3.0图像生成
```
POST /api/multimodal/generate-image
```

**请求体示例：**
```json
{
  "prompt": "鱼眼镜头，一只猫咪的头部，画面呈现出猫咪的五官因为拍摄方式扭曲的效果。",
  "size": "1024x1024",
  "guidance_scale": 3,
  "watermark": true,
  "style": "artistic",
  "count": 1,
  "response_format": "url"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "image": {
      "url": "https://example.com/generated-image.jpg",
      "revisedPrompt": "鱼眼镜头效果的猫咪头部特写..."
    },
    "metadata": {
      "originalPrompt": "鱼眼镜头，一只猫咪的头部...",
      "size": "1024x1024",
      "guidanceScale": 3,
      "watermark": true,
      "generatedAt": "2024-01-01T00:00:00.000Z",
      "source": "seedream",
      "modelUsed": "doubao-seedream-3-0-t2i-250415"
    }
  }
}
```

### 服务状态监控

#### 健康检查
```
GET /api/multimodal/health
```

#### 服务状态
```
GET /api/service/status
```

#### 重置多模态服务状态
```
POST /api/service/multimodal/reset
```

## 使用示例

### JavaScript/TypeScript客户端

```typescript
// 图像分析示例
async function analyzeImage(imageUrl: string, prompt: string) {
  const response = await fetch('/api/multimodal/analyze-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageUrl,
      prompt,
      targetLanguage: 'chinese',
      analysisType: 'description'
    })
  });
  
  const data = await response.json();
  return data;
}

// 词汇生成示例
async function generateVocabulary(imageUrl: string) {
  const response = await fetch('/api/multimodal/generate-vocabulary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageUrl,
      targetLanguage: 'english',
      difficulty: 'intermediate',
      wordCount: 10,
      includeExamples: true
    })
  });
  
  const data = await response.json();
  return data;
}

// 图像生成示例
async function generateImage(prompt: string) {
  const response = await fetch('/api/multimodal/generate-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      size: '1024x1024',
      guidance_scale: 3,
      watermark: true
    })
  });
  
  const data = await response.json();
  return data;
}
```

### cURL示例

```bash
# 图像分析
curl -X POST https://your-domain.com/api/multimodal/analyze-image \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/image.jpg",
    "prompt": "请分析这张图片的内容",
    "targetLanguage": "chinese"
  }'

# 图像生成（使用您提供的示例）
curl -X POST https://your-domain.com/api/multimodal/generate-image \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "鱼眼镜头，一只猫咪的头部，画面呈现出猫咪的五官因为拍摄方式扭曲的效果。",
    "size": "1024x1024",
    "guidance_scale": 3,
    "watermark": true
  }'
```

## 支持的图像格式

- **输入图像（分析）**：JPEG, PNG, WebP, GIF
- **输出图像（生成）**：PNG (URL格式) 或 Base64 (b64_json格式)

## 支持的图像尺寸（SeeDream 3.0）

- `1024x1024` - 正方形（推荐）
- `1280x720` - 16:9横向
- `720x1280` - 9:16竖向
- `512x512` - 小尺寸正方形

## 故障转移机制

当豆包服务不可用时，系统会自动：

1. **多模态功能降级**：转为纯文本模式，使用其他AI服务
2. **图像生成降级**：尝试使用Pexels图片API或返回占位图
3. **错误恢复**：自动重试和冷却机制

## 错误处理

常见错误及解决方案：

### 认证错误
```json
{
  "success": false,
  "error": "豆包API认证失败，请检查API密钥和端点配置"
}
```
**解决方案：** 检查 `DOUBAO_API_KEY` 和 `DOUBAO_ENDPOINT` 配置

### 网络错误
```json
{
  "success": false,
  "error": "豆包API请求超时"
}
```
**解决方案：** 检查网络连接或增加 `DOUBAO_TIMEOUT` 值

### 配置错误
```json
{
  "success": false,
  "error": "豆包端点ID未配置，请设置 DOUBAO_ENDPOINT 环境变量"
}
```
**解决方案：** 必须配置 `DOUBAO_ENDPOINT` 环境变量

## 性能优化建议

1. **图像大小**：使用适当的图像尺寸，避免过大的图像
2. **并发控制**：多模态请求消耗较多Token，注意速率限制
3. **缓存策略**：对相同图像的分析结果进行缓存
4. **降级策略**：准备备用的图片描述服务

## 监控和日志

- 服务状态：`GET /api/service/status`
- 健康检查：`GET /api/multimodal/health`
- 详细日志：查看应用日志中的多模态相关记录

## 故障排查

1. **检查环境变量配置**
2. **验证网络连接**
3. **查看服务状态监控**
4. **检查应用日志**
5. **测试基础API连通性**

---

该实现完全基于您提供的豆包1.6和SeeDream 3.0 API端点，确保与火山引擎官方API的完全兼容性。