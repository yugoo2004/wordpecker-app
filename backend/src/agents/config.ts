import 'dotenv/config';

export async function configureOpenAIAgents(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;

  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    const { setDefaultOpenAIKey } = await import('@openai/agents');
    
    // Set the API key
    setDefaultOpenAIKey(apiKey);
    
    if (baseURL) {
      console.log(`OpenAI Agents configured with API key. Custom baseURL: ${baseURL}`);
      console.log('Note: @openai/agents may not support custom baseURL. Consider using direct OpenAI client for Moonshot API.');
    } else {
      console.log('OpenAI Agents configured with default endpoint');
    }
    
  } catch (error) {
    console.error('Error loading @openai/agents:', error);
    process.exit(1);
  }
}