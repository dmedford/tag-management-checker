import { CheerioScanner } from '../src/core/cheerio-scanner.js';

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
    const { url: targetUrl, profile, environment = 'prod', gtmContainer } = req.body;
    
    if (!targetUrl) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }
    
    console.log(`🔍 Vercel scan: ${targetUrl} for account ${DEFAULT_TARGET_ACCOUNT}`);
    
    const scanner = new CheerioScanner({
      timeout: 25000,
      useEnhancedBrowserMimicking: true
    });
    
    const result = await scanner.scanUrl(
      targetUrl,
      DEFAULT_TARGET_ACCOUNT,
      profile || null,
      environment,
      gtmContainer || null
    );
    
    console.log(`✅ Vercel scan completed: ${result.found ? 'Found' : 'Not found'} Tealium`);
    
    return res.status(200).json({
      success: true,
      result: result,
      engine: 'vercel-serverless',
      note: 'Powered by Vercel Serverless Functions'
    });
    
  } catch (error) {
    console.error(`❌ Vercel scan error:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      engine: 'vercel-serverless'
    });
  }
}