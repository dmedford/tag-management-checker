#!/usr/bin/env node

/**
 * Tag Management Checker Web Server using Cheerio
 * Comprehensive tool for analyzing Tealium, GTM, and tag management implementations
 */

import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { CheerioScanner } from './src/core/cheerio-scanner.js';
import { CheerioDetector } from './src/core/cheerio-detector.js';
import { BrowserFallback } from './src/core/browser-fallback.js';
import { CrawleeFallback } from './src/core/crawlee-fallback.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 8889;
const DEFAULT_TARGET_ACCOUNT = process.env.TARGET_ACCOUNT || 'adtaxi';

// Request parser
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

// Serve static files
function serveFile(filePath, res) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath);
    let contentType = 'text/plain';
    
    switch (ext) {
      case '.html': contentType = 'text/html; charset=utf-8'; break;
      case '.js': contentType = 'application/javascript; charset=utf-8'; break;
      case '.css': contentType = 'text/css; charset=utf-8'; break;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
  }
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      account: DEFAULT_TARGET_ACCOUNT,
      server: 'cheerio-powered',
      timestamp: new Date().toISOString(),
      engine: 'Cheerio + Axios (No Browser Required)',
      advantages: ['Fast', 'Lightweight', 'No architecture issues', 'Works on any system']
    }));
    return;
  }
  
  // API: Single URL check
  if (url.pathname === '/api/check' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { url: targetUrl, profile, environment = 'prod', gtmContainer } = body;
      
      if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'URL is required' }));
        return;
      }
      
      console.log(`🔍 Cheerio scan: ${targetUrl} for account ${DEFAULT_TARGET_ACCOUNT}`);
      
      // Create Cheerio scanner with enhanced browser mimicking
      const scanner = new CheerioScanner({
        timeout: 25000,
        useEnhancedBrowserMimicking: true  // Enable enhanced detection
      });
      
      let result = await scanner.scanUrl(
        targetUrl,
        DEFAULT_TARGET_ACCOUNT,
        profile || null,
        environment,
        gtmContainer || null
      );
      
      console.log(`✅ Cheerio scan completed: ${result.found ? 'Found' : 'Not found'} Tealium`);
      
      // Check if Crawlee fallback is needed (prioritize over Puppeteer)
      const crawleeFallback = new CrawleeFallback({ timeout: 60000 });
      if (crawleeFallback.needsCrawleeFallback(targetUrl, result)) {
        console.log(`🕷️ Attempting Crawlee fallback for challenging site...`);
        try {
          const crawleeResult = await crawleeFallback.scanUrl(
            targetUrl,
            DEFAULT_TARGET_ACCOUNT,
            profile || null,
            environment,
            gtmContainer || null
          );
          
          // Use Crawlee result if it found more than Cheerio or if Cheerio failed
          const shouldUseCrawleeResult = crawleeResult.success && 
            (crawleeResult.found || (!result.success && crawleeResult.scripts?.length > 0));
          
          if (shouldUseCrawleeResult) {
            console.log(`🎯 Crawlee fallback successful - using Crawlee results`);
            console.log(`   📊 Crawlee found: ${crawleeResult.found}, scripts: ${crawleeResult.scripts?.length || 0}`);
            console.log(`   📊 Cheerio found: ${result.found}, success: ${result.success}`);
            result = crawleeResult;
            result.fallback_used = true;
          } else {
            console.log(`📊 Crawlee fallback completed - keeping original results`);
            console.log(`   📊 Crawlee success: ${crawleeResult.success}, found: ${crawleeResult.found}`);
            console.log(`   📊 Cheerio success: ${result.success}, found: ${result.found}`);
            result.fallback_attempted = true;
            result.fallback_needed = false;
            
            // Still add some debug info about what Crawlee found
            if (crawleeResult.success && crawleeResult.scripts?.length > 0) {
              result.crawlee_debug = {
                scripts_found: crawleeResult.scripts.length,
                tealium_found: crawleeResult.found,
                reason_not_used: "Crawlee didn't find more than Cheerio"
              };
            }
          }
        } catch (error) {
          console.log(`❌ Crawlee fallback failed: ${error.message}`);
          result.fallback_attempted = true;
          result.fallback_error = error.message;
          
          // If Crawlee fails, try Puppeteer as final backup (only if architecture allows)
          console.log(`🔄 Attempting Puppeteer backup for: ${targetUrl}`);
          const browserFallback = new BrowserFallback({ timeout: 30000 });
          try {
            const browserResult = await browserFallback.scanUrl(
              targetUrl,
              DEFAULT_TARGET_ACCOUNT,
              profile || null,
              environment,
              gtmContainer || null
            );
            
            if (browserResult.success && (browserResult.found && !result.found)) {
              console.log(`🎯 Puppeteer backup successful - using browser results`);
              result = browserResult;
              result.fallback_used = true;
              result.backup_method = 'puppeteer_after_crawlee';
            }
          } catch (puppeteerError) {
            console.log(`❌ Puppeteer backup also failed: ${puppeteerError.message}`);
          }
        }
      }
      
      const engineUsed = result.detection_method === 'crawlee_fallback' ? 'crawlee' : 
                        (result.detection_method === 'browser_fallback' ? 'puppeteer' : 'cheerio');
      const note = result.fallback_used 
        ? (result.detection_method === 'crawlee_fallback' ? 
           'Enhanced with Crawlee for advanced bot detection evasion' :
           'Enhanced with browser fallback for challenging sites')
        : 'Powered by Cheerio - no browser compatibility issues!';
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        result: result,
        engine: engineUsed,
        note: note
      }));
      
    } catch (error) {
      console.error(`❌ Cheerio scan error:`, error.message);
      
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error.message,
        engine: 'cheerio'
      }));
    }
    return;
  }
  
  // API: Multiple URL scan
  if (url.pathname === '/api/scan-multiple' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { urls, profile, environment = 'prod', gtmContainer } = body;
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'URLs array is required' }));
        return;
      }
      
      console.log(`🔍 Cheerio batch scan: ${urls.length} URLs for account ${DEFAULT_TARGET_ACCOUNT}`);
      
      const scanner = new CheerioScanner({
        timeout: 25000,
        useEnhancedBrowserMimicking: true  // Enable enhanced detection
      });
      
      const results = await scanner.scanUrls(
        urls,
        DEFAULT_TARGET_ACCOUNT,
        profile || null,
        environment,
        gtmContainer || null
      );
      
      console.log(`✅ Cheerio batch scan completed: ${results.filter(r => r.found).length}/${results.length} found Tealium`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        results: results,
        engine: 'cheerio'
      }));
      
    } catch (error) {
      console.error(`❌ Cheerio batch scan error:`, error.message);
      
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error.message,
        engine: 'cheerio'
      }));
    }
    return;
  }
  
  // API: Site crawl
  if (url.pathname === '/api/crawl-site' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { 
        url: targetUrl, 
        profile, 
        environment = 'prod', 
        gtmContainer,
        maxPages = 10,
        maxDepth = 2,
        excludePaths = ['/admin', '/wp-admin', '/private']
      } = body;
      
      if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'URL is required' }));
        return;
      }
      
      console.log(`🕷️ Cheerio site crawl: ${targetUrl} for account ${DEFAULT_TARGET_ACCOUNT}`);
      console.log(`   📊 Settings: ${maxPages} pages, depth ${maxDepth}`);
      
      const scanner = new CheerioScanner({
        timeout: 25000,
        useEnhancedBrowserMimicking: true  // Enable enhanced detection
      });
      
      const crawlOptions = {
        maxPages: parseInt(maxPages),
        maxDepth: parseInt(maxDepth),
        targetAccount: DEFAULT_TARGET_ACCOUNT,
        targetProfile: profile || null,
        environment,
        targetGtmContainer: gtmContainer || null,
        excludePaths
      };
      
      const result = await scanner.crawlSite(targetUrl, crawlOptions);
      
      console.log(`✅ Cheerio site crawl completed: ${result.pages?.length || 0} pages`);
      console.log(`   📊 Coverage: ${result.summary?.coverage_percentage || 0}%`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        result: result,
        engine: 'cheerio'
      }));
      
    } catch (error) {
      console.error(`❌ Cheerio site crawl error:`, error.message);
      
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error.message,
        engine: 'cheerio'
      }));
    }
    return;
  }
  
  // API: Site analysis for crawl recommendations
  if (url.pathname === '/api/analyze-site' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { url: targetUrl } = body;
      
      if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'URL is required' }));
        return;
      }
      
      console.log(`🔍 Analyzing site structure: ${targetUrl}`);
      
      const scanner = new CheerioScanner({
        timeout: 15000
      });
      
      const analysis = await scanner.analyzeSite(targetUrl);
      
      console.log(`✅ Site analysis completed for ${targetUrl}`);
      console.log(`   💡 Recommendation: ${analysis.recommendations?.max_pages || 'N/A'} pages, depth ${analysis.recommendations?.max_depth || 'N/A'}`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        analysis: analysis,
        engine: 'cheerio'
      }));
      
    } catch (error) {
      console.error(`❌ Site analysis error:`, error.message);
      
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error.message,
        engine: 'cheerio'
      }));
    }
    return;
  }
  
  // Static files
  if (req.method === 'GET') {
    let filePath;
    
    if (url.pathname === '/' || url.pathname === '/index.html') {
      filePath = path.join(__dirname, 'web', 'public', 'index.html');
    } else if (url.pathname === '/app.js') {
      filePath = path.join(__dirname, 'web', 'public', 'app.js');
    } else if (url.pathname === '/local-interface') {
      filePath = path.join(__dirname, 'local-interface.html');
    } else {
      filePath = path.join(__dirname, 'web', 'public', url.pathname);
    }
    
    serveFile(filePath, res);
    return;
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// Enhanced error handling
server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.log(`💡 Port ${port} is in use. Try: lsof -ti:${port} | xargs kill -9`);
  }
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.log('🔄 Server continuing...');
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  console.log('🔄 Server continuing...');
});

// Start server
server.listen(port, '127.0.0.1', () => {
  const addr = server.address();
  console.log('🏷️  Tag Management Checker Web Server (Cheerio Edition)');
  console.log(`   📍 Address: http://localhost:${addr.port}`);
  console.log(`   🎯 Account: ${DEFAULT_TARGET_ACCOUNT}`);
  console.log(`   ⚡ Engine: Cheerio + Axios (Lightweight)`);
  console.log(`   💻 Node Architecture: ${process.arch}`);
  console.log('');
  console.log('✅ Key Features:');
  console.log('   🏷️  Tealium + GTM Detection');
  console.log('   🔄 Migration Analysis');
  console.log('   🕷️  Site Crawling');
  console.log('   📊 Coverage Gap Analysis');
  console.log('   🚀 Fast - No browser overhead');
  console.log('   🪶 Lightweight - Just HTTP requests + HTML parsing');
  console.log('   🔧 No browser compatibility issues');
  console.log('   ✅ Works on any Node.js architecture');
  console.log('');
  console.log('🌐 Server ready! Open http://localhost:' + addr.port);
  console.log('⏹️  Press Ctrl+C to stop');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Tag Management Checker server...');
  server.close(() => {
    console.log('✅ Server closed.');
    process.exit(0);
  });
});