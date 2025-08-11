import { PlaywrightCrawler } from 'crawlee';
import { chromium } from 'playwright';

/**
 * Crawlee-based fallback detector for sites with sophisticated bot detection
 * More robust than Puppeteer for challenging sites and better architecture compatibility
 */
export class CrawleeFallback {
  constructor(options = {}) {
    this.timeout = options.timeout || 60000;
    this.headless = options.headless !== false; // Default to true
    this.crawlerOptions = {
      launchContext: {
        launchOptions: {
          headless: this.headless,
          timeout: 30000, // Browser launch timeout
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--disable-extensions',
            '--mute-audio',
            '--no-zygote',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ]
        }
      },
      requestHandlerTimeoutSecs: Math.floor(this.timeout / 1000),
      navigationTimeoutSecs: Math.floor(this.timeout / 1000),
      maxRequestRetries: 2,
      // Enhanced anti-detection
      browserPoolOptions: {
        useFingerprints: true, // Use realistic browser fingerprints
        fingerprintOptions: {
          fingerprintGeneratorOptions: {
            browsers: ['chrome'],
            operatingSystems: ['macos', 'windows'],
            devices: ['desktop']
          }
        }
      }
    };
  }

  /**
   * Check if a site needs Crawlee fallback (same logic as browser fallback)
   */
  needsCrawleeFallback(url, cheerioResult) {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // Known sites that serve different content to bots
    const knownBotDetectionSites = [
      'olympicgmc.com',
      'dealeron.com',
      'frankmanmotors.com'
    ];

    // Use Crawlee fallback if:
    // 1. Site is known to have bot detection
    const isKnownSite = knownBotDetectionSites.some(pattern => hostname.includes(pattern));
    
    // 2. Cheerio succeeded but found no Tealium despite having many scripts
    const hasManyScrpts = cheerioResult.success && cheerioResult.scripts?.length > 10;
    const noTealiumFound = !cheerioResult.found;
    const successfulButEmpty = hasManyScrpts && noTealiumFound;
    
    // 3. HTTP 403 Forbidden (bot detection)
    const isForbidden = !cheerioResult.success && 
                       (cheerioResult.error?.includes('403') || 
                        cheerioResult.error?.includes('Forbidden'));
    
    // 4. HTTP 503 Service Unavailable (rate limiting)
    const isRateLimited = !cheerioResult.success && 
                         (cheerioResult.error?.includes('503') || 
                          cheerioResult.error?.includes('Service Unavailable'));
    
    const shouldUseFallback = isKnownSite || successfulButEmpty || isForbidden || isRateLimited;
    
    if (shouldUseFallback) {
      console.log(`🕷️ Crawlee fallback triggered for ${hostname}:`);
      if (isKnownSite) console.log(`   • Known bot detection site`);
      if (successfulButEmpty) console.log(`   • Many scripts but no Tealium found`);
      if (isForbidden) console.log(`   • HTTP 403 Forbidden (bot detection)`);
      if (isRateLimited) console.log(`   • HTTP 503 Rate Limited`);
    }

    return shouldUseFallback;
  }

  /**
   * Scan URL using Crawlee with advanced bot detection evasion
   */
  async scanUrl(url, targetAccount, targetProfile = null, environment = 'prod', targetGtmContainer = null) {
    const result = {
      url,
      timestamp: new Date().toISOString(),
      success: false,
      found: false,
      matches: false,
      details: {},
      scripts: [],
      summary: '',
      detection_method: 'crawlee_fallback',
      gtm: {
        found: false,
        matches: false,
        containers: [],
        details: {},
        summary: ''
      }
    };

    console.log(`🕷️ Crawlee fallback: Starting advanced bot evasion for ${url}`);

    let crawler = null;
    let pageData = null;

    try {
      // Create crawler with enhanced anti-detection
      console.log(`🚀 Initializing Crawlee with anti-detection features...`);
      
      const self = this; // Store reference for use in requestHandler
      
      crawler = new PlaywrightCrawler({
        ...this.crawlerOptions,
        async requestHandler({ page, request, enqueueLinks }) {
          console.log(`🌐 Crawlee navigating to: ${request.url}`);
          console.log(`🕰️ Page load timeout: ${Math.floor(self.timeout / 1000)}s`);
          
          try {
            // Enhanced stealth setup
            await self.setupStealthMode(page);
            
            // Wait for page to be fully loaded
            console.log(`⏱️ Waiting for page load...`);
            const startTime = Date.now();
            
            // Wait for network to be mostly idle (like a real user)
            await page.waitForLoadState('domcontentloaded', { timeout: self.timeout });
            
            // Additional wait for dynamic content
            await page.waitForTimeout(2000 + Math.random() * 3000); // 2-5 seconds
            
            const endTime = Date.now();
            console.log(`✅ Page loaded in ${endTime - startTime}ms`);
            
            // Get page info
            const title = await page.title();
            const finalUrl = page.url();
            console.log(`📄 Page title: ${title}`);
            console.log(`🔗 Final URL: ${finalUrl}`);
            
            // Simulate human behavior
            await self.simulateHumanBehavior(page);
            
            // Extract script data
            pageData = await self.extractScriptData(page);
            
            console.log(`📊 Crawlee found ${pageData.external.length} external scripts, ${pageData.inline.length} inline scripts with tag patterns`);
            
          } catch (error) {
            console.log(`❌ Crawlee page processing failed: ${error.message}`);
            throw error;
          }
        },
        
        failedRequestHandler({ request }) {
          console.log(`❌ Crawlee request failed: ${request.url} - ${request.errorMessages?.join(', ')}`);
        }
      });

      // Run the crawler with proper URL format
      console.log(`📌 Adding URL to crawler queue: ${url}`);
      
      // Add URL to crawler queue first
      await crawler.addRequests([{ url }]);
      
      // Then run the crawler
      await crawler.run();

      // Process the extracted data
      if (pageData) {
        result.scripts = pageData.external.map(s => s.src);
        result.success = true;
        
        // Analyze for Tealium
        this.analyzeTealium(pageData, result, targetAccount, targetProfile, environment);
        
        // Analyze for GTM
        this.analyzeGTM(pageData, result, targetGtmContainer);
        
        // Generate summary
        if (result.matches) {
          result.summary = `✅ Found ${targetAccount} Tealium (Crawlee detection)`;
          if (result.details.profile) {
            result.summary += ` (${result.details.profile})`;
          }
        } else if (result.found) {
          // Check if it's AdTaxi account - treat as success
          if (result.details.account === 'adtaxi') {
            result.summary = `✅ Found AdTaxi Tealium implementation (Crawlee detection)`;
            if (result.details.profile) {
              result.summary = result.summary.replace('implementation', `account (${result.details.profile})`);
            }
          } else {
            result.summary = `⚠️ Different Tealium found: ${result.details.account || 'unknown'} (Crawlee detection)`;
          }
        } else {
          result.summary = 'No Tealium found (Crawlee detection)';
        }
        
        console.log(`✅ Crawlee scan complete: found=${result.found}, matches=${result.matches}`);
      } else {
        throw new Error('No data extracted from page');
      }

    } catch (error) {
      console.error(`❌ Crawlee fallback failed: ${error.message}`);
      result.success = false;
      result.error = error.message;
      result.summary = `❌ Crawlee detection failed: ${error.message}`;
    } finally {
      if (crawler) {
        try {
          await crawler.teardown();
          console.log(`🔒 Crawlee resources cleaned up`);
        } catch (cleanupError) {
          console.log(`⚠️ Cleanup warning: ${cleanupError.message}`);
        }
      }
    }

    return result;
  }

  /**
   * Setup enhanced stealth mode to avoid detection
   */
  async setupStealthMode(page) {
    console.log(`🥷 Setting up stealth mode...`);
    
    // Enhanced stealth JavaScript injection
    await page.addInitScript(() => {
      // Remove webdriver indicators
      delete Object.getPrototypeOf(navigator).webdriver;
      delete window.navigator.webdriver;
      delete window.navigator.__webdriver_script_fn;
      
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true
      });
      
      // Mock chrome object
      window.chrome = {
        runtime: {
          onConnect: undefined,
          onMessage: undefined,
          connect: () => ({})
        },
        loadTimes: () => ({
          connectionInfo: 'h2',
          finishDocumentLoadTime: performance.now() + Math.random() * 1000,
          finishLoadTime: performance.now() + Math.random() * 1500,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: performance.now() + Math.random() * 500,
          navigationType: 'Navigation',
          npnNegotiatedProtocol: 'h2',
          requestTime: Date.now() - Math.random() * 3000,
          startLoadTime: performance.now() - Math.random() * 2000
        }),
        csi: () => ({
          onloadT: Date.now(),
          startE: Date.now() - Math.random() * 5000,
          tran: Math.floor(Math.random() * 20)
        })
      };
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', description: '', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', description: '', filename: 'internal-nacl-plugin' }
        ]
      });
      
      // Mock hardware
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8 + Math.floor(Math.random() * 8)
      });
      
      // Mock device memory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8 + Math.floor(Math.random() * 24)
      });
    });

    // Set realistic viewport
    await page.setViewportSize({ 
      width: 1920 + Math.floor(Math.random() * 100), 
      height: 1080 + Math.floor(Math.random() * 100) 
    });
    
    console.log(`✅ Stealth mode configured`);
  }

  /**
   * Simulate human-like behavior
   */
  async simulateHumanBehavior(page) {
    console.log(`👤 Simulating human behavior...`);
    
    try {
      // Random mouse movement
      await page.mouse.move(
        Math.random() * 1920, 
        Math.random() * 1080
      );
      
      // Human thinking time
      await page.waitForTimeout(1000 + Math.random() * 2000);
      
      // Scroll behavior like a human reading
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, Math.random() * 400 + 200);
        });
        await page.waitForTimeout(800 + Math.random() * 1200);
      }
      
      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500 + Math.random() * 1000);
      
      console.log(`✅ Human behavior simulation complete`);
    } catch (error) {
      console.log(`⚠️ Human behavior simulation warning: ${error.message}`);
    }
  }

  /**
   * Extract script data from the page
   */
  async extractScriptData(page) {
    console.log(`🔍 Extracting script data...`);
    
    const scriptData = await page.evaluate(() => {
      const external = [];
      const inline = [];
      
      // Get external scripts
      const scriptElements = document.querySelectorAll('script[src]');
      scriptElements.forEach(script => {
        external.push({
          src: script.src,
          async: script.async,
          defer: script.defer,
          type: script.type
        });
      });
      
      // Get inline scripts with tag management patterns
      const inlineElements = document.querySelectorAll('script:not([src])');
      inlineElements.forEach(script => {
        const content = script.innerHTML;
        if (content.includes('tiqcdn') || content.includes('utag') || content.includes('tealium') ||
            content.includes('GTM-') || content.includes('googletagmanager')) {
          inline.push(content);
        }
      });
      
      return { external, inline };
    });
    
    return scriptData;
  }

  /**
   * Analyze script data for Tealium (reuse logic from browser fallback)
   */
  analyzeTealium(scriptData, result, targetAccount, targetProfile, environment) {
    // Check external scripts
    const tealiumScripts = scriptData.external.filter(script => {
      const src = script.src.toLowerCase();
      return src.includes('tiqcdn.com') || 
             src.includes('utag.js') ||
             src.includes('tealium');
    });

    console.log(`🔍 Crawlee found ${tealiumScripts.length} external Tealium scripts`);

    if (tealiumScripts.length > 0) {
      result.found = true;
      
      // Analyze each script
      tealiumScripts.forEach(script => {
        const analysis = this.parseUtagUrl(script.src);
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

    // Check inline scripts for dynamic loading
    scriptData.inline.forEach(scriptContent => {
      if (scriptContent.includes('tiqcdn') || scriptContent.includes('utag')) {
        console.log(`🔍 Found Tealium reference in inline script`);
        
        const urlMatches = scriptContent.match(/['\"](.*?tiqcdn\\.com.*?utag\\.js.*?)['\"];?/g);
        if (urlMatches && !result.found) {
          result.found = true;
          
          urlMatches.forEach(match => {
            const cleanUrl = match.replace(/['\"]/g, '').replace(/;$/, '');
            const fullUrl = cleanUrl.startsWith('//') ? `https:${cleanUrl}` : cleanUrl;
            
            const analysis = this.parseUtagUrl(fullUrl);
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
      }
    });
  }

  /**
   * Analyze script data for GTM
   */
  analyzeGTM(scriptData, result, targetGtmContainer) {
    const containerIds = new Set();

    // Check external scripts
    scriptData.external.forEach(script => {
      const src = script.src;
      if (src.includes('googletagmanager.com')) {
        const gtmMatch = src.match(/[?&]id=(GTM-[A-Z0-9]{6,})/);
        const gtagMatch = src.match(/[?&]id=(G-[A-Z0-9]{10})/);
        
        if (gtmMatch) containerIds.add(gtmMatch[1]);
        if (gtagMatch) containerIds.add(gtagMatch[1]);
      }
    });

    // Check inline scripts
    scriptData.inline.forEach(scriptContent => {
      const gtmMatches = scriptContent.match(/['\"\\`]GTM-[A-Z0-9]{6,}['\"\\`]/g);
      if (gtmMatches) {
        gtmMatches.forEach(match => {
          const containerId = match.replace(/['\"\\`]/g, '');
          containerIds.add(containerId);
        });
      }

      const ga4Matches = scriptContent.match(/['\"\\`]G-[A-Z0-9]{10}['\"\\`]/g);
      if (ga4Matches) {
        ga4Matches.forEach(match => {
          const measurementId = match.replace(/['\"\\`]/g, '');
          containerIds.add(measurementId);
        });
      }
    });

    result.gtm.containers = Array.from(containerIds);
    result.gtm.found = result.gtm.containers.length > 0;

    if (result.gtm.found) {
      console.log(`📊 Crawlee found ${result.gtm.containers.length} GTM containers: ${result.gtm.containers.join(', ')}`);
      
      result.gtm.details.total_containers = result.gtm.containers.length;
      
      if (targetGtmContainer) {
        result.gtm.matches = result.gtm.containers.includes(targetGtmContainer);
        result.gtm.summary = result.gtm.matches 
          ? `✅ Found target GTM: ${targetGtmContainer}`
          : `⚠️ Target GTM not found. Found: ${result.gtm.containers.join(', ')}`;
      } else {
        result.gtm.matches = true;
        result.gtm.summary = `✅ Found ${result.gtm.containers.length} GTM containers (Crawlee)`;
      }
    } else {
      result.gtm.summary = 'No GTM found (Crawlee detection)';
    }
  }

  /**
   * Parse Tealium URL to extract account, profile, environment
   */
  parseUtagUrl(url) {
    const analysis = {
      account: null,
      profile: null,
      environment: null
    };

    // Standard pattern: https://tags.tiqcdn.com/utag/ACCOUNT/PROFILE/ENVIRONMENT/utag.js
    const regex = /https?:\/\/tags\.tiqcdn\.com\/utag\/([^\/]+)\/([^\/]+)\/([^\/]+)\/utag\.js/;
    const match = url.match(regex);

    if (match) {
      analysis.account = match[1];
      analysis.profile = match[2];
      analysis.environment = match[3];
    }

    return analysis;
  }
}

export default CrawleeFallback;