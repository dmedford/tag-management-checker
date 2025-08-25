#!/usr/bin/env node

/**
 * Vercel Serverless Function for Tag Management Checker
 * Handles all routes and API endpoints
 */

import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { CheerioScanner } from '../src/core/cheerio-scanner.js';
import { CheerioDetector } from '../src/core/cheerio-detector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

// Main Vercel handler
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const url = new URL(req.url, `https://${req.headers.host}`);
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // Health check
  if (url.pathname === '/health') {
    res.status(200).json({
      status: 'ok',
      account: DEFAULT_TARGET_ACCOUNT,
      server: 'vercel-serverless',
      timestamp: new Date().toISOString(),
      engine: 'Cheerio + Axios (Serverless)',
      advantages: ['Serverless', 'Auto-scaling', 'Global CDN', 'Zero config']
    });
    return;
  }
  
  // API: Single URL check
  if (url.pathname === '/api/check' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { url: targetUrl, profile, environment = 'prod', gtmContainer } = body;
      
      if (!targetUrl) {
        res.status(400).json({ success: false, error: 'URL is required' });
        return;
      }
      
      console.log(`🔍 Serverless scan: ${targetUrl} for account ${DEFAULT_TARGET_ACCOUNT}`);
      
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
      
      console.log(`✅ Serverless scan completed: ${result.found ? 'Found' : 'Not found'} Tealium`);
      
      res.status(200).json({
        success: true,
        result: result,
        engine: 'vercel-serverless',
        note: 'Powered by Vercel Serverless Functions'
      });
      
    } catch (error) {
      console.error(`❌ Serverless scan error:`, error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        engine: 'vercel-serverless'
      });
    }
    return;
  }
  
  // API: Multiple URL scan
  if (url.pathname === '/api/scan-multiple' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { urls, profile, environment = 'prod', gtmContainer } = body;
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        res.status(400).json({ success: false, error: 'URLs array is required' });
        return;
      }
      
      console.log(`🔍 Serverless batch scan: ${urls.length} URLs`);
      
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
      
      res.status(200).json({
        success: true,
        results: results,
        engine: 'vercel-serverless'
      });
      
    } catch (error) {
      console.error(`❌ Serverless batch scan error:`, error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        engine: 'vercel-serverless'
      });
    }
    return;
  }
  
  // Static files
  if (req.method === 'GET') {
    let filePath;
    
    if (url.pathname === '/' || url.pathname === '/index.html') {
      filePath = path.join(__dirname, '..', 'web', 'public', 'index.html');
    } else if (url.pathname === '/app.js') {
      filePath = path.join(__dirname, '..', 'web', 'public', 'app.js');
    } else {
      filePath = path.join(__dirname, '..', 'web', 'public', url.pathname);
    }
    
    serveFile(filePath, res);
    return;
  }
  
  // 404
  res.status(404).end('Not found');
}