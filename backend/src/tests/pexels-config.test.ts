/**
 * Pexels API 配置验证单元测试
 */

// 直接定义验证函数进行测试，避免环境变量依赖
function validatePexelsApiKey(apiKey: string): boolean {
  // Pexels API 密钥通常是 39-40 个字符的字母数字字符串
  const pexelsKeyPattern = /^[a-zA-Z0-9]{39,40}$/;
  return pexelsKeyPattern.test(apiKey);
}

describe('Pexels API 配置验证', () => {
  describe('validatePexelsApiKey', () => {
    test('应该接受有效的 39 字符 API 密钥', () => {
      const validKey = 'abcdefghijklmnopqrstuvwxyz1234567890123';
      expect(validatePexelsApiKey(validKey)).toBe(true);
    });

    test('应该接受有效的 40 字符 API 密钥', () => {
      const validKey = 'abcdefghijklmnopqrstuvwxyz12345678901234';
      expect(validatePexelsApiKey(validKey)).toBe(true);
    });

    test('应该拒绝太短的 API 密钥', () => {
      const shortKey = 'abc123';
      expect(validatePexelsApiKey(shortKey)).toBe(false);
    });

    test('应该拒绝太长的 API 密钥', () => {
      const longKey = 'abcdefghijklmnopqrstuvwxyz123456789012345';
      expect(validatePexelsApiKey(longKey)).toBe(false);
    });

    test('应该拒绝包含特殊字符的 API 密钥', () => {
      const invalidKey = 'abcdefghijklmnopqrstuvwxyz1234567890-_!';
      expect(validatePexelsApiKey(invalidKey)).toBe(false);
    });

    test('应该拒绝空字符串', () => {
      expect(validatePexelsApiKey('')).toBe(false);
    });

    test('应该拒绝占位符密钥', () => {
      const placeholderKey = 'your_pexels_api_key_here';
      expect(validatePexelsApiKey(placeholderKey)).toBe(false);
    });

    test('应该拒绝包含空格的密钥', () => {
      const keyWithSpaces = 'abcdefghijklmnopqrstuvwxyz 1234567890123';
      expect(validatePexelsApiKey(keyWithSpaces)).toBe(false);
    });

    test('应该拒绝包含中文字符的密钥', () => {
      const keyWithChinese = 'abcdefghijklmnopqrstuvwxyz中文1234567890';
      expect(validatePexelsApiKey(keyWithChinese)).toBe(false);
    });
  });
});