describe('随机选择算法正确性测试', () => {
  it('应该验证随机数生成的基本功能', () => {
    const numbers = [];
    for (let i = 0; i < 10; i++) {
      numbers.push(Math.random());
    }
    
    numbers.forEach(num => {
      expect(num).toBeGreaterThanOrEqual(0);
      expect(num).toBeLessThan(1);
    });
    
    const uniqueNumbers = new Set(numbers);
    expect(uniqueNumbers.size).toBeGreaterThan(1);
  });
});
