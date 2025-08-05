import request from 'supertest';
import express from 'express';
import imageDescriptionRoutes from '../api/image-description/routes';

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api/image-description', imageDescriptionRoutes);

describe('随机图片API端点测试', () => {
  describe('路由定义验证', () => {
    test('GET /random 端点应该存在', async () => {
      const response = await request(app)
        .get('/api/image-description/random');
      
      // 端点存在（不是404）
      expect(response.status).not.toBe(404);
    });

    test('GET /random/:category 端点应该存在', async () => {
      const response = await request(app)
        .get('/api/image-description/random/nature');
      
      // 端点存在（不是404）
      expect(response.status).not.toBe(404);
    });

    test('GET /validate-api 端点应该存在', async () => {
      const response = await request(app)
        .get('/api/image-description/validate-api');
      
      // 端点存在（不是404）
      expect(response.status).not.toBe(404);
    });
  });

  describe('参数验证', () => {
    test('随机图片端点应该接受查询参数', async () => {
      const response = await request(app)
        .get('/api/image-description/random?sessionId=test&query=nature');
      
      // 应该能处理查询参数（不是400参数错误）
      expect(response.status).not.toBe(400);
    });

    test('分类随机图片端点应该接受路径参数', async () => {
      const response = await request(app)
        .get('/api/image-description/random/technology?sessionId=test');
      
      // 应该能处理路径和查询参数（不是400参数错误）
      expect(response.status).not.toBe(400);
    });
  });

  describe('响应格式验证', () => {
    test('API配置验证端点应该返回JSON响应', async () => {
      const response = await request(app)
        .get('/api/image-description/validate-api');
      
      // 应该返回JSON内容类型
      expect(response.headers['content-type']).toMatch(/json/);
      
      // 响应应该有success字段
      expect(response.body).toHaveProperty('success');
      expect(typeof response.body.success).toBe('boolean');
    });

    test('随机图片端点错误响应应该包含标准字段', async () => {
      const response = await request(app)
        .get('/api/image-description/random');
      
      // 由于API密钥问题，应该返回错误响应
      if (response.status >= 400) {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('code');
      }
    });

    test('分类随机图片端点错误响应应该包含类别信息', async () => {
      const category = 'test-category';
      const response = await request(app)
        .get(`/api/image-description/random/${category}`);
      
      // 由于API密钥问题，应该返回错误响应
      if (response.status >= 400) {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('category', category);
      }
    });
  });

  describe('错误处理验证', () => {
    test('无效的分类参数应该被正确处理', async () => {
      // 测试空分类（这会导致路由不匹配）
      const response = await request(app)
        .get('/api/image-description/random/');
      
      // 应该返回404（路由不匹配）或其他适当的错误
      expect([404, 500]).toContain(response.status);
    });

    test('API端点应该处理内部错误', async () => {
      const response = await request(app)
        .get('/api/image-description/random');
      
      // 由于API密钥配置问题，应该返回适当的错误状态码
      expect(response.status).toBeGreaterThanOrEqual(400);
      
      // 错误响应应该是JSON格式
      expect(response.headers['content-type']).toMatch(/json/);
    });
  });

  describe('HTTP方法验证', () => {
    test('随机图片端点应该只支持GET方法', async () => {
      const postResponse = await request(app)
        .post('/api/image-description/random');
      
      const putResponse = await request(app)
        .put('/api/image-description/random');
      
      const deleteResponse = await request(app)
        .delete('/api/image-description/random');
      
      // POST, PUT, DELETE 应该返回405 Method Not Allowed 或 404
      expect([404, 405]).toContain(postResponse.status);
      expect([404, 405]).toContain(putResponse.status);
      expect([404, 405]).toContain(deleteResponse.status);
    });
  });
});