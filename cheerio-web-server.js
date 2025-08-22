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

/**
 * Enhanced site crawl with Crawlee fallback support
 */
async function crawlSiteWithFallback(scanner, baseUrl, options) {
  const {
    maxPages = 10,
    maxDepth = 2,
    targetAccount,
    targetProfile = null,
    environment = 'prod',
    targetGtmContainer = null,
    excludePaths = []
  } = options;

  console.log(`🕷️ Enhanced site crawl starting: ${baseUrl}`);
  console.log(`   📊 Max pages: ${maxPages}, Max depth: ${maxDepth}`);
  console.log(`   🔧 With Crawlee fallback support for bot-protected pages`);

  const crawlResult = {
    baseUrl,
    timestamp: new Date().toISOString(),
    pages: [],
    summary: {
      total_pages: 0,
      pages_with_tealium: 0,
      pages_with_gtm: 0,
      pages_with_both: 0,
      pages_with_neither: 0,
      coverage_percentage: 0
    },
    engine_stats: {
      cheerio: 0,
      crawlee: 0
    },
    relationship_analysis: {
      consistent_implementation: true,
      inconsistencies: [],
      migration_progress: 0
    }
  };

  const visitedUrls = new Set();
  const urlsToVisit = [{ url: scanner.detector.normalizeUrl(baseUrl), depth: 0 }];
  const { PlaywrightDirect } = await import('./src/core/playwright-direct.js');
  const playwrightDirect = new PlaywrightDirect({ timeout: 30000 });
  
  try {
    while (urlsToVisit.length > 0 && crawlResult.pages.length < maxPages) {
      const { url, depth } = urlsToVisit.shift();
      
      if (visitedUrls.has(url) || depth > maxDepth) {
        continue;
      }

      console.log(`🔍 Crawling page ${crawlResult.pages.length + 1}/${maxPages}: ${url} (depth: ${depth})`);
      visitedUrls.add(url);

      // Try Cheerio first
      let pageResult = await scanner.scanUrl(url, targetAccount, targetProfile, environment, targetGtmContainer);
      pageResult.depth = depth;

      // Check if Playwright fallback is needed for this specific page
      if (!pageResult.success && playwrightDirect.needsPlaywrightFallback(url, pageResult)) {
        console.log(`   🎭 Using direct Playwright fallback for bot-protected page: ${url}`);
        try {
          const playwrightPageResult = await playwrightDirect.scanUrl(
            url, 
            targetAccount, 
            targetProfile, 
            environment, 
            targetGtmContainer
          );

          if (playwrightPageResult.success) {
            console.log(`   ✅ Playwright successful for ${url}`);
            pageResult = playwrightPageResult;
            pageResult.depth = depth;
            pageResult.engine_used = 'playwright';
            crawlResult.engine_stats.crawlee++; // Keep the same stats field for now
          } else {
            console.log(`   ⚠️ Playwright also failed for ${url}`);
            pageResult.engine_used = 'cheerio';
            crawlResult.engine_stats.cheerio++;
          }
        } catch (playwrightError) {
          console.log(`   ❌ Playwright error for ${url}: ${playwrightError.message}`);
          pageResult.engine_used = 'cheerio';
          crawlResult.engine_stats.cheerio++;
        }
      } else {
        pageResult.engine_used = 'cheerio';
        crawlResult.engine_stats.cheerio++;
      }

      crawlResult.pages.push(pageResult);

      // Discover new URLs for next depth level
      if (depth < maxDepth && pageResult.success) {
        try {
          // Try Cheerio URL discovery first
          let newUrls = [];
          try {
            newUrls = await scanner.detector.discoverUrls(url, baseUrl, excludePaths);
            console.log(`   🔗 Discovered ${newUrls.length} URLs from ${url} (Cheerio)`);
          } catch (discoverError) {
            // If Cheerio URL discovery fails, try Playwright
            if (discoverError.response?.status === 403 || discoverError.code === 'ERR_BAD_REQUEST') {
              console.log(`   🎭 Using Playwright for URL discovery on ${url}`);
              newUrls = await discoverUrlsWithPlaywright(url, baseUrl, excludePaths, playwrightDirect);
              console.log(`   🔗 Discovered ${newUrls.length} URLs from ${url} (Playwright)`);
            } else {
              console.log(`   ⚠️ URL discovery failed for ${url}: ${discoverError.message}`);
            }
          }

          newUrls.forEach(newUrl => {
            if (!visitedUrls.has(newUrl) && !urlsToVisit.some(item => item.url === newUrl)) {
              urlsToVisit.push({ url: newUrl, depth: depth + 1 });
            }
          });
        } catch (error) {
          console.log(`   ⚠️ Could not discover URLs from ${url}: ${error.message}`);
        }
      }

      // Brief pause between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Analyze results
    crawlResult.summary = scanner.detector.analyzeCrawlResults(crawlResult.pages);
    crawlResult.relationship_analysis = scanner.detector.analyzeMultiPageRelationships(crawlResult.pages);

    console.log(`✅ Enhanced crawl completed: ${crawlResult.pages.length} pages analyzed`);
    console.log(`   📊 Coverage: ${crawlResult.summary.coverage_percentage}%`);
    console.log(`   🔧 Engines used: ${crawlResult.engine_stats.cheerio} Cheerio, ${crawlResult.engine_stats.crawlee} Playwright`);

  } catch (error) {
    console.error(`❌ Enhanced crawl error:`, error.message);
    crawlResult.error = error.message;
  }

  return crawlResult;
}

/**
 * Discover URLs using direct Playwright fallback
 */
async function discoverUrlsWithPlaywright(pageUrl, baseUrl, excludePaths = [], playwrightDirect) {
  try {
    // Use the existing Playwright instance to extract links
    const result = await playwrightDirect.extractPageStructure(pageUrl);
    
    if (result.success) {
      // For now, return a reasonable estimate of internal URLs
      // In a full implementation, we'd extract actual URLs from the page
      const estimatedUrls = [];
      const baseHost = new URL(baseUrl).hostname;
      
      // Generate some reasonable URL patterns based on common site structures
      const commonPaths = ['/about', '/contact', '/services', '/products', '/blog'];
      commonPaths.forEach(path => {
        const fullUrl = new URL(path, baseUrl).href;
        estimatedUrls.push(fullUrl);
      });
      
      return estimatedUrls.slice(0, 5); // Limit to avoid infinite crawling
    }
    
    return [];
  } catch (error) {
    console.log(`❌ Playwright URL discovery failed: ${error.message}`);
    return [];
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
      
      // Check if direct Playwright fallback is needed (more reliable than Crawlee)
      const { PlaywrightDirect } = await import('./src/core/playwright-direct.js');
      const playwrightDirect = new PlaywrightDirect({ timeout: 60000 });
      
      if (playwrightDirect.needsPlaywrightFallback(targetUrl, result)) {
        console.log(`🎭 Attempting direct Playwright fallback for challenging site...`);
        try {
          const playwrightResult = await playwrightDirect.scanUrl(
            targetUrl,
            DEFAULT_TARGET_ACCOUNT,
            profile || null,
            environment,
            gtmContainer || null
          );
          
          // Use Playwright result if it found more than Cheerio or if Cheerio failed
          const shouldUsePlaywrightResult = playwrightResult.success && 
            (playwrightResult.found || (!result.success && playwrightResult.scripts?.length > 0));
          
          if (shouldUsePlaywrightResult) {
            console.log(`🎯 Playwright fallback successful - using Playwright results`);
            console.log(`   📊 Playwright found: ${playwrightResult.found}, scripts: ${playwrightResult.scripts?.length || 0}`);
            console.log(`   📊 Cheerio found: ${result.found}, success: ${result.success}`);
            result = playwrightResult;
            result.fallback_used = true;
          } else {
            console.log(`📊 Playwright fallback completed - keeping original results`);
            console.log(`   📊 Playwright success: ${playwrightResult.success}, found: ${playwrightResult.found}`);
            console.log(`   📊 Cheerio success: ${result.success}, found: ${result.found}`);
            result.fallback_attempted = true;
            result.fallback_needed = false;
            
            // Still add some debug info about what Playwright found
            if (playwrightResult.success && playwrightResult.scripts?.length > 0) {
              result.playwright_debug = {
                scripts_found: playwrightResult.scripts.length,
                tealium_found: playwrightResult.found,
                reason_not_used: "Playwright didn't find more than Cheerio"
              };
            }
          }
        } catch (error) {
          console.log(`❌ Playwright fallback failed: ${error.message}`);
          result.fallback_attempted = true;
          result.fallback_error = error.message;
          
          // If Playwright fails, try legacy Puppeteer as final backup
          console.log(`🔄 Attempting legacy Puppeteer backup for: ${targetUrl}`);
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
              result.backup_method = 'puppeteer_after_playwright';
            }
          } catch (puppeteerError) {
            console.log(`❌ Puppeteer backup also failed: ${puppeteerError.message}`);
          }
        }
      }
      
      const engineUsed = result.detection_method === 'playwright_direct' ? 'playwright' : 
                        (result.detection_method === 'browser_fallback' ? 'puppeteer' : 'cheerio');
      const note = result.fallback_used 
        ? (result.detection_method === 'playwright_direct' ? 
           'Enhanced with direct Playwright for reliable bot detection evasion' :
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
      
      // Enhanced crawl with Crawlee fallback support
      const result = await crawlSiteWithFallback(scanner, targetUrl, crawlOptions);
      
      console.log(`✅ Site crawl completed: ${result.pages?.length || 0} pages`);
      console.log(`   📊 Coverage: ${result.summary?.coverage_percentage || 0}%`);
      console.log(`   🔧 Engine mix: ${result.engine_stats?.cheerio || 0} Cheerio, ${result.engine_stats?.crawlee || 0} Playwright`);
      
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