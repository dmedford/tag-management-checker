import puppeteer from 'puppeteer';
import { CheerioDetector } from './cheerio-detector.js';

/**
 * Hybrid Detector - Combines Cheerio + Puppeteer for maximum reliability
 * 
 * Strategy:
 * 1. Try Cheerio first (fast, lightweight)
 * 2. If Tealium expected but not found, fallback to Puppeteer (handles dynamic content)
 * 3. Use real browser to bypass content serving differences
 */
export class HybridDetector {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.cheerioDetector = new CheerioDetector(options);
    this.puppeteerOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ],
      timeout: this.timeout
    };
  }

  /**
   * Scan URL with hybrid approach
   */
  async scanUrl(url, targetAccount, targetProfile = null, environment = 'prod', targetGtmContainer = null) {
    console.log(`🔄 Starting hybrid scan: ${url}`);
    
    // Step 1: Try Cheerio first (fast path)
    console.log(`⚡ Phase 1: Cheerio detection`);
    const cheerioResult = await this.cheerioDetector.scanUrl(url, targetAccount, targetProfile, environment, targetGtmContainer);
    
    // If Cheerio found what we're looking for, return immediately
    if (cheerioResult.success && (cheerioResult.matches || cheerioResult.found)) {
      console.log(`✅ Cheerio detection SUCCESS - found implementation`);
      cheerioResult.detection_method = 'cheerio';
      cheerioResult.hybrid_info = {
        cheerio_attempted: true,
        cheerio_success: true,
        puppeteer_attempted: false,
        puppeteer_needed: false
      };
      return cheerioResult;
    }

    // Step 2: Determine if Puppeteer fallback is warranted
    const shouldUsePuppeteer = this.shouldFallbackToPuppeteer(cheerioResult, url);
    
    if (!shouldUsePuppeteer) {
      console.log(`📊 Cheerio result sufficient - no Puppeteer fallback needed`);
      cheerioResult.detection_method = 'cheerio';
      cheerioResult.hybrid_info = {
        cheerio_attempted: true,
        cheerio_success: cheerioResult.success,
        puppeteer_attempted: false,
        puppeteer_needed: false
      };
      return cheerioResult;
    }

    // Step 3: Puppeteer fallback for challenging sites
    console.log(`🌐 Phase 2: Puppeteer fallback (dynamic content handling)`);
    try {
      const puppeteerResult = await this.puppeteerScan(url, targetAccount, targetProfile, environment, targetGtmContainer);
      
      // Merge results - prefer Puppeteer data if it found more
      const mergedResult = this.mergeResults(cheerioResult, puppeteerResult);
      mergedResult.detection_method = 'hybrid';
      mergedResult.hybrid_info = {
        cheerio_attempted: true,
        cheerio_success: cheerioResult.success,
        puppeteer_attempted: true,
        puppeteer_success: puppeteerResult.success,
        puppeteer_needed: true,
        content_difference_detected: puppeteerResult.found && !cheerioResult.found
      };

      console.log(`🎯 Hybrid scan complete - method: ${mergedResult.detection_method}`);
      return mergedResult;

    } catch (puppeteerError) {
      console.log(`❌ Puppeteer fallback failed: ${puppeteerError.message}`);
      
      // Return Cheerio result with error info
      cheerioResult.detection_method = 'cheerio_only';
      cheerioResult.hybrid_info = {
        cheerio_attempted: true,
        cheerio_success: cheerioResult.success,
        puppeteer_attempted: true,
        puppeteer_success: false,
        puppeteer_error: puppeteerError.message,
        fallback_failed: true
      };
      return cheerioResult;
    }
  }

  /**
   * Determine if Puppeteer fallback is warranted
   */
  shouldFallbackToPuppeteer(cheerioResult, url) {
    // Use Puppeteer if:
    // 1. Cheerio scan failed entirely
    if (!cheerioResult.success) {
      console.log(`🎯 Puppeteer fallback: Cheerio scan failed`);
      return true;
    }

    // 2. Site has complex behavior patterns (known sites that serve different content)
    const knownDynamicSites = [
      'olympicgmc.com',
      'dealeron.com', // Car dealer platforms often have dynamic tag loading
      'wp-engine.com',
      'wordpress.com'
    ];

    const hostname = new URL(cheerioResult.url).hostname.toLowerCase();
    if (knownDynamicSites.some(pattern => hostname.includes(pattern))) {
      console.log(`🎯 Puppeteer fallback: Known dynamic site pattern (${hostname})`);
      return true;
    }

    // 3. Site has many scripts but no tag management (suspicious)
    const hasManyscripts = cheerioResult.scripts && cheerioResult.scripts.length > 15;
    const noTagManagement = !cheerioResult.found && (!cheerioResult.gtm || !cheerioResult.gtm.found);
    
    if (hasManyscripts && noTagManagement) {
      console.log(`🎯 Puppeteer fallback: Many scripts (${cheerioResult.scripts.length}) but no tag management found`);
      return true;
    }

    // 4. GTM found but no Tealium (might be dynamic loading)
    const hasGTM = cheerioResult.gtm && cheerioResult.gtm.found;
    const noTealium = !cheerioResult.found;
    
    if (hasGTM && noTealium) {
      console.log(`🎯 Puppeteer fallback: GTM found but no Tealium (possible dynamic loading)`);
      return true;
    }

    return false;
  }

  /**
   * Perform Puppeteer-based scan with browser automation
   */
  async puppeteerScan(url, targetAccount, targetProfile, environment, targetGtmContainer) {
    let browser = null;
    let page = null;

    try {
      console.log(`🚀 Launching Puppeteer browser`);
      browser = await puppeteer.launch(this.puppeteerOptions);
      page = await browser.newPage();

      // Set realistic browser headers and viewport
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to page
      console.log(`📍 Navigating to: ${url}`);
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: this.timeout 
      });

      // Wait for potential dynamic script loading
      console.log(`⏱️ Waiting for dynamic scripts to load...`);
      await page.waitForTimeout(3000);

      // Extract all scripts from the page
      const scriptData = await page.evaluate(() => {
        const scripts = [];
        const scriptElements = document.querySelectorAll('script[src]');
        
        scriptElements.forEach(script => {
          scripts.push({
            src: script.src,
            async: script.async,
            defer: script.defer,
            type: script.type
          });
        });

        // Also check inline scripts for dynamic loading
        const inlineScripts = [];
        const inlineElements = document.querySelectorAll('script:not([src])');
        inlineElements.forEach(script => {
          const content = script.innerHTML;
          if (content.includes('tiqcdn') || content.includes('utag') || content.includes('tealium')) {
            inlineScripts.push(content);
          }
        });

        return { external: scripts, inline: inlineScripts };
      });

      console.log(`📊 Puppeteer found ${scriptData.external.length} external scripts, ${scriptData.inline.length} inline scripts with Tealium references`);

      // Analyze the scripts for Tealium and GTM
      const result = this.analyzeScriptData(scriptData, url, targetAccount, targetProfile, environment, targetGtmContainer);
      
      // Extract data layer information
      const dataLayerInfo = await page.evaluate(() => {
        const data = {};
        
        // Check for Tealium data layer
        if (typeof window.utag_data !== 'undefined') {
          data.utag_data = window.utag_data;
        }
        
        // Check for GTM data layer
        if (typeof window.dataLayer !== 'undefined') {
          data.dataLayer = window.dataLayer;
        }

        // Check for Tealium configuration
        if (typeof window.utag !== 'undefined') {
          data.utag_config = {
            version: window.utag.cfg?.v,
            account: window.utag.cfg?.utid,
            profile: window.utag.cfg?.template,
            environment: window.utag.cfg?.env
          };
        }

        return data;
      });

      result.dataLayer = dataLayerInfo;
      result.success = true;
      
      console.log(`✅ Puppeteer scan completed - found: ${result.found}, matches: ${result.matches}`);
      return result;

    } catch (error) {
      console.error(`❌ Puppeteer scan failed: ${error.message}`);
      
      return {
        url,
        timestamp: new Date().toISOString(),
        success: false,
        found: false,
        matches: false,
        error: error.message,
        scripts: [],
        summary: `❌ Puppeteer scan failed: ${error.message}`,
        gtm: { found: false, containers: [], details: {}, summary: '' }
      };
    } finally {
      if (browser) {
        await browser.close();
        console.log(`🔒 Puppeteer browser closed`);
      }
    }
  }

  /**
   * Analyze script data extracted by Puppeteer
   */
  analyzeScriptData(scriptData, url, targetAccount, targetProfile, environment, targetGtmContainer) {
    const result = {
      url,
      timestamp: new Date().toISOString(),
      success: true,
      found: false,
      matches: false,
      details: {},
      scripts: scriptData.external.map(s => s.src),
      summary: '',
      gtm: {
        found: false,
        matches: false,
        containers: [],
        details: {},
        summary: ''
      }
    };

    // Analyze external scripts for Tealium
    const tealiumScripts = scriptData.external.filter(script => {
      const src = script.src.toLowerCase();
      return src.includes('tiqcdn.com') || 
             src.includes('utag.js') ||
             src.includes('tealium');
    });

    console.log(`🔍 Puppeteer found ${tealiumScripts.length} Tealium scripts`);

    if (tealiumScripts.length > 0) {
      result.found = true;
      
      // Analyze each Tealium script
      tealiumScripts.forEach(script => {
        const analysis = this.analyzeTealiumScript(script.src);
        if (analysis.account) {
          result.details = { ...result.details, ...analysis };
          
          // Check for match
          if (analysis.account === targetAccount &&
              (!targetProfile || analysis.profile === targetProfile) &&
              analysis.environment === environment) {
            result.matches = true;
          }
        }
      });
    }

    // Analyze inline scripts for dynamic Tealium loading
    if (scriptData.inline.length > 0) {
      console.log(`🔍 Analyzing ${scriptData.inline.length} inline scripts for dynamic Tealium loading`);
      
      scriptData.inline.forEach(scriptContent => {
        // Extract URLs from dynamic loading patterns
        const urlMatches = scriptContent.match(/['"](.*?tiqcdn\.com.*?utag\.js.*?)['"];?/g);
        if (urlMatches) {
          urlMatches.forEach(match => {
            const cleanUrl = match.replace(/['"]/g, '').replace(/;$/, '');
            const fullUrl = cleanUrl.startsWith('//') ? `https:${cleanUrl}` : cleanUrl;
            
            console.log(`📍 Found dynamic Tealium script: ${fullUrl}`);
            
            if (!result.found) result.found = true;
            
            const analysis = this.analyzeTealiumScript(fullUrl);
            if (analysis.account) {
              result.details = { ...result.details, ...analysis };
              
              if (analysis.account === targetAccount &&
                  (!targetProfile || analysis.profile === targetProfile) &&
                  analysis.environment === environment) {
                result.matches = true;
              }
            }
          });
        }
      });
    }

    // Analyze GTM (using similar logic to CheerioDetector)
    result.gtm = this.analyzeGTMFromScripts(scriptData, targetGtmContainer);

    // Generate summary
    if (result.matches) {
      result.summary = `✅ Found ${targetAccount} Tealium account`;
      if (result.details.profile) {
        result.summary += ` (${result.details.profile})`;
      }
    } else if (result.found) {
      // Check if it's AdTaxi account - treat as success
      if (result.details.account === 'adtaxi') {
        result.summary = `✅ Found AdTaxi Tealium account`;
        if (result.details.profile) {
          result.summary += ` (${result.details.profile})`;
        }
      } else {
        result.summary = `⚠️ Found different Tealium account: ${result.details.account || 'unknown'}`;
        if (result.details.profile) {
          result.summary += ` (${result.details.profile})`;
        }
      }
    } else {
      result.summary = 'No Tealium implementation detected';
    }

    return result;
  }

  /**
   * Analyze Tealium script URL (reuse from CheerioDetector)
   */
  analyzeTealiumScript(scriptSrc) {
    const analysis = {
      account: null,
      profile: null,
      environment: null,
      tealium_version: null
    };

    // Standard Tealium URL pattern
    const tealiumRegex = /https?:\/\/tags\.tiqcdn\.com\/utag\/([^\/]+)\/([^\/]+)\/([^\/]+)\/utag\.js/;
    const match = scriptSrc.match(tealiumRegex);

    if (match) {
      analysis.account = match[1];
      analysis.profile = match[2];
      analysis.environment = match[3];
    }

    return analysis;
  }

  /**
   * Analyze GTM from script data
   */
  analyzeGTMFromScripts(scriptData, targetGtmContainer) {
    const gtmResult = {
      found: false,
      matches: false,
      containers: [],
      details: {},
      summary: ''
    };

    const containerIds = new Set();

    // Check external scripts for GTM
    scriptData.external.forEach(script => {
      const src = script.src;
      if (src.includes('googletagmanager.com')) {
        const gtmMatch = src.match(/[?&]id=(GTM-[A-Z0-9]{6,})/);
        const gtagMatch = src.match(/[?&]id=(G-[A-Z0-9]{10})/);
        
        if (gtmMatch) containerIds.add(gtmMatch[1]);
        if (gtagMatch) containerIds.add(gtagMatch[1]);
      }
    });

    // Check inline scripts for GTM
    scriptData.inline.forEach(scriptContent => {
      const gtmMatches = scriptContent.match(/['"`]GTM-[A-Z0-9]{6,}['"`]/g);
      if (gtmMatches) {
        gtmMatches.forEach(match => {
          const containerId = match.replace(/['"`]/g, '');
          containerIds.add(containerId);
        });
      }

      const ga4Matches = scriptContent.match(/['"`]G-[A-Z0-9]{10}['"`]/g);
      if (ga4Matches) {
        ga4Matches.forEach(match => {
          const measurementId = match.replace(/['"`]/g, '');
          containerIds.add(measurementId);
        });
      }
    });

    gtmResult.containers = Array.from(containerIds);
    gtmResult.found = gtmResult.containers.length > 0;

    if (gtmResult.found) {
      gtmResult.details.total_containers = gtmResult.containers.length;
      
      if (targetGtmContainer) {
        gtmResult.matches = gtmResult.containers.includes(targetGtmContainer);
        gtmResult.summary = gtmResult.matches 
          ? `✅ Found target GTM container: ${targetGtmContainer}`
          : `⚠️ Target container not found. Found: ${gtmResult.containers.join(', ')}`;
      } else {
        gtmResult.matches = true;
        gtmResult.summary = gtmResult.containers.length === 1
          ? `✅ Found GTM container: ${gtmResult.containers[0]}`
          : `✅ Found ${gtmResult.containers.length} containers: ${gtmResult.containers.join(', ')}`;
      }
    } else {
      gtmResult.summary = 'No GTM containers detected';
    }

    return gtmResult;
  }

  /**
   * Merge Cheerio and Puppeteer results, preferring more complete data
   */
  mergeResults(cheerioResult, puppeteerResult) {
    // Start with the result that found more information
    const baseResult = puppeteerResult.found ? puppeteerResult : cheerioResult;
    
    // Merge additional information
    const merged = { ...baseResult };
    
    // Combine scripts (unique)
    const allScripts = new Set([
      ...(cheerioResult.scripts || []),
      ...(puppeteerResult.scripts || [])
    ]);
    merged.scripts = Array.from(allScripts);
    
    // Use the more successful result's core detection
    if (puppeteerResult.found && !cheerioResult.found) {
      merged.found = puppeteerResult.found;
      merged.matches = puppeteerResult.matches;
      merged.details = puppeteerResult.details;
      merged.summary = puppeteerResult.summary;
    }
    
    // Combine GTM results (prefer the one that found more containers)
    const cheerioContainers = cheerioResult.gtm?.containers?.length || 0;
    const puppeteerContainers = puppeteerResult.gtm?.containers?.length || 0;
    
    if (puppeteerContainers > cheerioContainers) {
      merged.gtm = puppeteerResult.gtm;
    } else if (cheerioContainers > 0) {
      merged.gtm = cheerioResult.gtm;
    }
    
    // Add data layer information if available
    if (puppeteerResult.dataLayer) {
      merged.dataLayer = puppeteerResult.dataLayer;
    }
    
    return merged;
  }

  /**
   * Scan multiple URLs with hybrid approach
   */
  async scanUrls(urls, targetAccount, targetProfile = null, environment = 'prod', targetGtmContainer = null) {
    console.log(`🔄 Starting hybrid batch scan: ${urls.length} URLs`);
    
    const results = [];
    
    for (const url of urls) {
      try {
        const result = await this.scanUrl(url, targetAccount, targetProfile, environment, targetGtmContainer);
        results.push(result);
        
        // Brief pause between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({
          url,
          timestamp: new Date().toISOString(),
          success: false,
          error: error.message,
          summary: `❌ Scan failed: ${error.message}`
        });
      }
    }
    
    console.log(`✅ Hybrid batch scan complete: ${results.length} results`);
    return results;
  }

  /**
   * Crawl site using hybrid approach for better accuracy
   */
  async crawlSite(baseUrl, options = {}) {
    // Use CheerioDetector's crawl functionality but with hybrid scanning
    return await this.cheerioDetector.crawlSite(baseUrl, {
      ...options,
      // Override the scanner to use hybrid approach
      scanner: this
    });
  }

  /**
   * Analyze site structure (delegate to CheerioDetector)
   */
  async analyzeSite(baseUrl) {
    return await this.cheerioDetector.analyzeSite(baseUrl);
  }
}

export default HybridDetector;