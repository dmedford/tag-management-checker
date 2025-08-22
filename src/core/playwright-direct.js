#!/usr/bin/env node

/**
 * Direct Playwright Implementation for Reliable Bot Detection Evasion
 * More reliable than Crawlee's abstraction layer
 */

import { chromium } from 'playwright';
import { CheerioDetector } from './cheerio-detector.js';

export class PlaywrightDirect {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.detector = new CheerioDetector();
    this.retryAttempts = options.retryAttempts || 2;
  }

  /**
   * Check if Playwright direct fallback is needed
   */
  needsPlaywrightFallback(url, cheerioResult) {
    if (!cheerioResult) return true;
    
    // Use Playwright for 403 errors, connection issues, or suspected bot detection
    return !cheerioResult.success && (
      cheerioResult.error?.includes('403') ||
      cheerioResult.error?.includes('Forbidden') ||
      cheerioResult.error?.includes('ECONNRESET') ||
      cheerioResult.error?.includes('ENOTFOUND') ||
      cheerioResult.error?.includes('timeout') ||
      cheerioResult.error?.includes('blocked') ||
      cheerioResult.error?.includes('denied')
    );
  }

  /**
   * Setup comprehensive stealth mode for Playwright
   */
  async setupStealthMode(page) {
    // Hide WebDriver automation indicators
    await page.addInitScript(() => {
      // Override webdriver detection
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override plugin array
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Override chrome runtime
      if (!window.chrome) {
        window.chrome = {};
      }
      if (!window.chrome.runtime) {
        window.chrome.runtime = {};
      }
    });
  }

  /**
   * Scan URL with direct Playwright
   */
  async scanUrl(url, targetAccount = 'adtaxi', targetProfile = null, environment = 'prod', targetGtmContainer = null) {
    console.log(`🎭 Direct Playwright scan: ${url}`);
    
    let browser = null;
    let context = null;
    let page = null;

    try {
      // Launch browser with stealth options
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });

      // Create stealth context
      context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none'
        }
      });

      page = await context.newPage();
      await this.setupStealthMode(page);

      // Navigate with retry logic
      let response = null;
      for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
        try {
          console.log(`🎭 Attempt ${attempt}/${this.retryAttempts} for ${url}`);
          
          response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: this.timeout
          });
          
          if (response && response.status() < 400) {
            break; // Success
          } else if (attempt === this.retryAttempts) {
            throw new Error(`HTTP ${response?.status() || 'unknown'}: ${response?.statusText() || 'Failed to load'}`);
          }
        } catch (error) {
          if (attempt === this.retryAttempts) {
            throw error;
          }
          console.log(`⚠️ Attempt ${attempt} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Additional wait for dynamic content
      await page.waitForTimeout(3000);

      // Extract page content
      const content = await page.content();
      const pageTitle = await page.title();
      
      console.log(`📄 Page loaded: "${pageTitle}" (${content.length} chars)`);

      // Create a mock response object to mimic what CheerioDetector expects
      const mockResponse = {
        status: response?.status() || 200,
        data: content
      };

      // Analyze content by replicating the CheerioDetector logic
      const result = await this.analyzeContentDirectly(mockResponse, url, targetAccount, targetProfile, environment, targetGtmContainer);
      
      // Add Playwright-specific metadata
      result.detection_method = 'playwright_direct';
      result.fallback_used = true;
      result.page_title = pageTitle;
      result.response_status = response?.status();
      result.content_length = content.length;

      console.log(`✅ Playwright scan complete: ${result.found ? 'Found' : 'Not found'} target implementation`);
      
      return result;

    } catch (error) {
      console.error(`❌ Playwright scan failed: ${error.message}`);
      
      return {
        url,
        timestamp: new Date().toISOString(),
        success: false,
        found: false,
        matches: false,
        error: error.message,
        detection_method: 'playwright_direct',
        fallback_used: true,
        scripts: [],
        details: null,
        summary: `❌ Error: ${error.message}`
      };
    } finally {
      // Cleanup
      try {
        if (page) await page.close();
        if (context) await context.close();
        if (browser) await browser.close();
      } catch (cleanupError) {
        console.log(`⚠️ Cleanup warning: ${cleanupError.message}`);
      }
    }
  }

  /**
   * Extract page structure for site analysis
   */
  async extractPageStructure(url) {
    console.log(`🎭 Direct Playwright structure analysis: ${url}`);
    
    let browser = null;
    let context = null;
    let page = null;

    try {
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      
      page = await context.newPage();
      await this.setupStealthMode(page);

      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.timeout
      });

      if (!response || response.status() >= 400) {
        throw new Error(`HTTP ${response?.status() || 'unknown'}: Failed to load page`);
      }

      await page.waitForTimeout(2000);

      // Extract structure data
      const structureData = await page.evaluate((baseUrl) => {
        const links = document.querySelectorAll('a[href]');
        const baseDomain = new URL(baseUrl).hostname;
        
        let totalLinks = links.length;
        let internalLinks = 0;
        const pathDepths = [];
        
        links.forEach(link => {
          const href = link.getAttribute('href');
          if (!href) return;
          
          try {
            let fullUrl;
            if (href.startsWith('http')) {
              fullUrl = href;
            } else if (href.startsWith('/')) {
              fullUrl = new URL(href, baseUrl).href;
            } else {
              fullUrl = new URL(href, baseUrl).href;
            }
            
            const urlObj = new URL(fullUrl);
            if (urlObj.hostname === baseDomain) {
              internalLinks++;
              const pathSegments = urlObj.pathname.split('/').filter(Boolean);
              pathDepths.push(pathSegments.length);
            }
          } catch (e) {
            // Skip invalid URLs
          }
        });
        
        // Calculate estimated depth
        let estimatedDepth = 1;
        if (pathDepths.length > 0) {
          const avgDepth = pathDepths.reduce((a, b) => a + b, 0) / pathDepths.length;
          estimatedDepth = Math.min(Math.max(Math.ceil(avgDepth), 2), 4);
        }
        
        // Determine navigation complexity
        const navElements = document.querySelectorAll('nav, .nav, .navigation, .menu, header').length;
        const menuItems = document.querySelectorAll('nav a, .nav a, .menu a, header a').length;
        
        let complexity = 'simple';
        if (menuItems > 20 || internalLinks > 50) {
          complexity = 'complex';
        } else if (menuItems > 10 || internalLinks > 20) {
          complexity = 'moderate';
        }
        
        return {
          total_links: totalLinks,
          internal_links: internalLinks,
          estimated_depth: estimatedDepth,
          navigation_complexity: complexity,
          menu_items: menuItems,
          nav_elements: navElements
        };
      }, url);

      console.log(`📊 Structure extracted: ${structureData.internal_links} internal links, depth ${structureData.estimated_depth}`);

      return {
        success: true,
        total_links: structureData.total_links,
        internal_links: structureData.internal_links,
        estimated_depth: structureData.estimated_depth,
        navigation_complexity: structureData.navigation_complexity,
        error: null
      };

    } catch (error) {
      console.error(`❌ Playwright structure analysis failed: ${error.message}`);
      
      return {
        success: false,
        total_links: 0,
        internal_links: 0,
        estimated_depth: 1,
        navigation_complexity: 'simple',
        error: error.message
      };
    } finally {
      try {
        if (page) await page.close();
        if (context) await context.close();
        if (browser) await browser.close();
      } catch (cleanupError) {
        console.log(`⚠️ Cleanup warning: ${cleanupError.message}`);
      }
    }
  }

  /**
   * Analyze content directly using the same logic as CheerioDetector
   * This replicates the core detection logic without needing to call the detector
   */
  async analyzeContentDirectly(response, url, targetAccount, targetProfile = null, environment = 'prod', targetGtmContainer = null) {
    const result = {
      url,
      timestamp: new Date().toISOString(),
      success: false,
      found: false,
      matches: false,
      details: {},
      scripts: [],
      summary: '',
      verboseError: null,
      // GTM results
      gtm: {
        found: false,
        matches: false,
        containers: [],
        details: {},
        summary: ''
      }
    };

    try {
      // Import Cheerio and load content
      const cheerio = await import('cheerio');
      const $ = cheerio.load(response.data);
      
      // Extract all script sources
      const scriptElements = $('script[src]').toArray();
      const scripts = scriptElements.map(el => $(el).attr('src')).filter(Boolean);
      
      result.scripts = scripts;
      result.success = true;

      console.log(`🎭 Playwright found ${scripts.length} script tags`);

      // Find Tealium scripts (same logic as CheerioDetector)
      const tealiumScripts = scripts.filter(src => {
        const srcLower = (src || '').toLowerCase();
        return srcLower.includes('tiqcdn.com') || 
               srcLower.includes('utag.js') ||
               srcLower.includes('tealium') ||
               srcLower.match(/utag.*\.js/) ||
               srcLower.includes('tags.tiqcdn')
      });

      console.log(`🎭 Playwright found ${tealiumScripts.length} potential Tealium scripts`);

      // Check for inline Tealium scripts (same logic as CheerioDetector)
      const inlineScripts = $('script:not([src])').toArray();
      const tealiumInlineDetections = [];
      
      inlineScripts.forEach(scriptEl => {
        const scriptContent = $(scriptEl).html() || '';
        if (scriptContent.includes('tiqcdn.com') || 
            scriptContent.includes('utag.js') || 
            scriptContent.includes('tealium')) {
          tealiumInlineDetections.push(scriptContent.substring(0, 200) + '...');
        }
      });

      console.log(`🎭 Playwright found ${tealiumInlineDetections.length} inline Tealium references`);

      // Use the enhanced GTM detection from CheerioDetector
      const gtmResult = this.detector.detectGTM($, targetGtmContainer);
      
      console.log(`🎭 Playwright GTM detection result: ${gtmResult.found ? 'Found' : 'Not found'}`);
      console.log(`🎭 GTM containers: ${gtmResult.containers.join(', ')}`);

      // Set GTM results from detector
      result.gtm = gtmResult;

      // Process Tealium results (same logic as CheerioDetector)
      const allTealiumSources = [...tealiumScripts, ...tealiumInlineDetections];
      
      if (allTealiumSources.length > 0) {
        result.found = true;
        
        // Parse and validate Tealium implementation
        const tealiumDetails = this.parseTealiumImplementation(allTealiumSources, targetAccount, targetProfile, environment);
        result.details = tealiumDetails;
        result.matches = tealiumDetails.accountMatch && (targetProfile ? tealiumDetails.profileMatch : true);
        
        result.summary = result.matches 
          ? `✅ Found ${targetAccount} Tealium account${targetProfile ? ` (${targetProfile})` : ''}`
          : `⚠️ Found different Tealium account: ${tealiumDetails.account || 'unknown'}`;
      } else {
        result.summary = '❌ No Tealium implementation detected';
      }

      // Set GTM summary
      if (result.gtm.found) {
        result.gtm.summary = result.gtm.matches && targetGtmContainer
          ? `✅ Found target GTM container: ${targetGtmContainer}`
          : `⚠️ Found GTM containers: ${gtmContainers.join(', ')}`;
      } else {
        result.gtm.summary = '❌ No GTM implementation detected';
      }

      console.log(`🎭 Playwright analysis complete: Tealium ${result.found}, GTM ${result.gtm.found}`);
      
      return result;

    } catch (error) {
      console.error(`❌ Playwright content analysis failed: ${error.message}`);
      
      result.success = false;
      result.error = error.message;
      result.summary = `❌ Error: ${error.message}`;
      
      return result;
    }
  }

  /**
   * Parse Tealium implementation details (helper method)
   */
  parseTealiumImplementation(sources, targetAccount, targetProfile, environment) {
    const details = {
      account: null,
      profile: null,
      environment: null,
      accountMatch: false,
      profileMatch: false,
      environmentMatch: false
    };

    sources.forEach(source => {
      // Extract from URL pattern: //tags.tiqcdn.com/utag/ACCOUNT/PROFILE/ENV/utag.js
      const match = source.match(/tiqcdn\.com\/utag\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
      if (match) {
        details.account = match[1];
        details.profile = match[2];
        details.environment = match[3];
      }
    });

    details.accountMatch = details.account === targetAccount;
    details.profileMatch = !targetProfile || details.profile === targetProfile;
    details.environmentMatch = details.environment === environment;

    return details;
  }
}

export default PlaywrightDirect;