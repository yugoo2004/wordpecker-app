import { StockPhotoService } from '../api/image-description/stock-photo-service';
import { validatePexelsApiKey } from '../config/environment';

// 模拟 fetch 函数
global.fetch = jest.fn();

describe('API 密钥验证功能测试', () => {
  let service: StockPhotoService;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    service = new StockPhotoService();
    jest.clearAllMocks();
  });

  describe('validatePexelsApiKey 函数测试', () => {
    it('应该接受有效的 Pexels API 密钥格式', () => {
      // 测试有效的API密钥格式（30-60个字符的字母数字字符串）
      const validKeys = [
        'abcdefghijklmnopqrstuvwxyz1234', // 30个字符
        'abcdefghijklmnopqrstuvwxyz1234567890', // 36个字符
        'abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr', // 56个字符
        'abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstu', // 60个字符
        '123456789012345678901234567890', // 30个字符，只有数字
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234' // 30个字符，只有大写字母
      ];

      validKeys.forEach(key => {
        expect(validatePexelsApiKey(key)).toBe(true);
      });
    });

    it('应该拒绝无效的 Pexels API 密钥格式', () => {
      // 测试明确无效的密钥
      expect(validatePexelsApiKey('')).toBe(false); // 空字符串
      expect(validatePexelsApiKey('short')).toBe(false); // 太短
      expect(validatePexelsApiKey('abcdefghijklmnopqrstuvwxyz123')).toBe(false); // 29个字符（太短）
      expect(validatePexelsApiKey('a'.repeat(61))).toBe(false); // 61个字符（太长）
      expect(validatePexelsApiKey('abcdefghijklmnopqrstuvwxyz-123456789')).toBe(false); // 包含连字符
      expect(validatePexelsApiKey('abcdefghijklmnopqrstuvwxyz_123456789')).toBe(false); // 包含下划线
      expect(validatePexelsApiKey('abcdefghijklmnopqrstuvwxyz 123456789')).toBe(false); // 包含空格
      expect(validatePexelsApiKey('abcdefghijklmnopqrstuvwxyz@123456789')).toBe(false); // 包含特殊字符
    });

    it('应该处理边界情况', () => {
      // 测试边界情况
      expect(validatePexelsApiKey(null as any)).toBe(false);
      expect(validatePexelsApiKey(undefined as any)).toBe(false);
      expect(validatePexelsApiKey(123 as any)).toBe(false);
      expect(validatePexelsApiKey({} as any)).toBe(false);
      expect(validatePexelsApiKey([] as any)).toBe(false);
    });
  });

  describe('StockPhotoService.validateApiKey 方法测试', () => {
    it('应该在API密钥有效时返回true', async () => {
      // 模拟成功的API响应
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ photos: [] })
      } as Response);

      const result = await service.validateApiKey();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.pexels.com/v1/search?query=test&per_page=1',
        {
          headers: {
            'Authorization': expect.any(String)
          }
        }
      );
    });

    it('应该在API密钥无效时返回false（401错误）', async () => {
      // 模拟401未授权响应
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers()
      } as Response);

      const result = await service.validateApiKey();
      expect(result).toBe(false);
    });

    it('应该在配额达到限制时返回true（429错误）', async () => {
      // 模拟429配额限制响应
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers()
      } as Response);

      const result = await service.validateApiKey();
      expect(result).toBe(true); // 密钥有效，但配额已用完
    });

    it('应该在其他HTTP错误时返回false', async () => {
      // 测试各种HTTP错误状态码
      const errorStatuses = [400, 403, 404, 500, 502, 503];

      for (const status of errorStatuses) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status,
          statusText: `Error ${status}`,
          headers: new Headers()
        } as Response);

        const result = await service.validateApiKey();
        expect(result).toBe(false);
      }

      expect(mockFetch).toHaveBeenCalledTimes(errorStatuses.length);
    });

    it('应该在网络错误时返回false', async () => {
      // 模拟网络错误
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.validateApiKey();
      expect(result).toBe(false);
    });

    it('应该在超时错误时返回false', async () => {
      // 模拟超时错误
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      const result = await service.validateApiKey();
      expect(result).toBe(false);
    });

    it('应该正确处理DNS解析错误', async () => {
      // 模拟DNS解析错误
      mockFetch.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND api.pexels.com'));

      const result = await service.validateApiKey();
      expect(result).toBe(false);
    });

    it('应该正确处理SSL证书错误', async () => {
      // 模拟SSL证书错误
      mockFetch.mockRejectedValueOnce(new Error('certificate verify failed'));

      const result = await service.validateApiKey();
      expect(result).toBe(false);
    });

    it('应该在测试环境中跳过API密钥格式验证', async () => {
      // 在测试环境中，即使API密钥格式无效，也应该继续验证
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      } as Response);

      const result = await service.validateApiKey();
      expect(result).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('API密钥验证的边界情况测试', () => {
    it('应该处理空响应体', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => null
      } as Response);

      const result = await service.validateApiKey();
      expect(result).toBe(true);
    });

    it('应该处理格式错误的JSON响应', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => { throw new Error('Invalid JSON'); }
      } as unknown as Response);

      const result = await service.validateApiKey();
      expect(result).toBe(true); // 只要HTTP状态码正确，就认为密钥有效
    });

    it('应该处理非标准的HTTP状态码', async () => {
      // 测试一些非标准但可能出现的状态码
      const unusualStatuses = [
        { status: 418, expected: false }, // I'm a teapot
        { status: 451, expected: false }, // Unavailable For Legal Reasons
        { status: 599, expected: false }  // Network Connect Timeout Error
      ];

      for (const { status, expected } of unusualStatuses) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status,
          statusText: `Status ${status}`,
          headers: new Headers()
        } as Response);

        const result = await service.validateApiKey();
        expect(result).toBe(expected);
      }
    });
  });

  describe('API密钥验证性能测试', () => {
    it('应该在合理时间内完成验证', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      } as Response);

      const startTime = Date.now();
      await service.validateApiKey();
      const endTime = Date.now();

      // 验证应该在1秒内完成（在正常网络条件下）
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('应该能够处理并发验证请求', async () => {
      // 模拟多个并发验证请求
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      } as Response);

      const promises = Array.from({ length: 5 }, () => service.validateApiKey());
      const results = await Promise.all(promises);

      // 所有请求都应该成功
      results.forEach(result => {
        expect(result).toBe(true);
      });

      // 应该发送了5个请求
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });
});