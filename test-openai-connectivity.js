const axios = require('axios');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config({ path: 'backend/.env' });

async function testOpenAIConnectivity() {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

    console.log('测试OpenAI API连通性...');
    console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : '未配置');
    console.log('Base URL:', baseUrl);

    if (!apiKey || apiKey === 'your_openai_api_key_here') {
        console.log('❌ OpenAI API密钥未配置');
        return false;
    }

    try {
        const modelsUrl = `${baseUrl}/models`;
        console.log('请求URL:', modelsUrl);

        const response = await axios.get(modelsUrl, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            timeout: 5000
        });

        if (response.status === 200) {
            console.log('✅ OpenAI API连通性测试成功');
            console.log('可用模型数量:', response.data.data?.length || 0);
            if (response.data.data && response.data.data.length > 0) {
                console.log('第一个模型:', response.data.data[0].id);
            }
            return true;
        } else {
            console.log('❌ OpenAI API连通性测试失败，状态码:', response.status);
            return false;
        }
    } catch (error) {
        console.log('❌ OpenAI API连通性测试失败');
        console.log('错误信息:', error.message);
        if (error.response) {
            console.log('响应状态:', error.response.status);
            console.log('响应数据:', error.response.data);
        }
        return false;
    }
}

testOpenAIConnectivity();