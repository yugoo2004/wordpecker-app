import 'dotenv/config';

export async function configureOpenAIAgents(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY || 'dummy-key-replaced-by-volcengine';
  const baseURL = process.env.OPENAI_BASE_URL;

  // 注释掉强制要求 OpenAI API key 的检查，因为已经使用火山引擎替代
  // if (!apiKey) {
  //   console.error('Error: OPENAI_API_KEY environment variable is required');
  //   process.exit(1);
  // }

  console.log('OpenAI Agents configuration disabled - using Volcengine instead');
  
  try {
    // 尝试加载但不强制要求成功
    const { setDefaultOpenAIKey } = await import('@openai/agents');
    
    // Set the API key (dummy key since we're using Volcengine)
    setDefaultOpenAIKey(apiKey);
    
    if (baseURL) {
      console.log(`OpenAI Agents configured with dummy API key. Custom baseURL: ${baseURL} (Note: Using Volcengine instead)`);
    } else {
      console.log('OpenAI Agents configured with dummy key (Note: Using Volcengine instead)');
    }
    
  } catch (error) {
    console.log('OpenAI Agents not available, using Volcengine services instead:', error?.message || 'Unknown error');
    // 不再强制退出，因为我们有火山引擎作为替代
    // process.exit(1);
  }
}
