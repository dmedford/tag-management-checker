const DEFAULT_TARGET_ACCOUNT = process.env.TARGET_ACCOUNT || 'adtaxi';

export default async function handler(req, res) {
  console.log('API check handler called:', req.method, req.url);
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For now, return a simple test response to debug
    return res.status(200).json({
      success: true,
      message: 'API endpoint is working',
      method: req.method,
      body: req.body,
      account: DEFAULT_TARGET_ACCOUNT,
      engine: 'vercel-serverless'
    });
    
  } catch (error) {
    console.error(`❌ Vercel API error:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      engine: 'vercel-serverless'
    });
  }
}