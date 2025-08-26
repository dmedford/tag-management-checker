import { CheerioScanner } from '../src/core/cheerio-scanner.js';

const DEFAULT_TARGET_ACCOUNT = process.env.TARGET_ACCOUNT || 'adtaxi';

export default async function handler(req, res) {
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
    const { urls, profile, environment = 'prod', gtmContainer } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ success: false, error: 'URLs array is required' });
    }
    
    console.log(`🔍 Vercel batch scan: ${urls.length} URLs`);
    
    const scanner = new CheerioScanner({
      timeout: 25000,
      useEnhancedBrowserMimicking: true
    });
    
    const results = await scanner.scanUrls(
      urls,
      DEFAULT_TARGET_ACCOUNT,
      profile || null,
      environment,
      gtmContainer || null
    );
    
    return res.status(200).json({
      success: true,
      results: results,
      engine: 'vercel-serverless'
    });
    
  } catch (error) {
    console.error(`❌ Vercel batch scan error:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      engine: 'vercel-serverless'
    });
  }
}