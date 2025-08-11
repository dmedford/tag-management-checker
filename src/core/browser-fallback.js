import puppeteer from 'puppeteer';

/**
 * Browser-based fallback detector for sites with sophisticated bot detection
 * Used only when Cheerio detection fails on known problematic sites
 */
export class BrowserFallback {
  constructor(options = {}) {
    this.timeout = options.timeout || 60000; // Increased timeout
    this.puppeteerOptions = {
      headless: "new", // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-features=VizDisplayCompositor',
        // Enhanced anti-detection
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-default-apps',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-back-forward-cache',
        '--disable-ipc-flooding-protection',
        // Ignore certificate errors
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--ignore-certificate-errors-spki-list',
        // Additional stealth options
        '--disable-web-security',
        '--allow-running-insecure-content',
        // Address ARM64/x64 compatibility issues
        '--single-process',
        '--no-zygote'
      ],
      timeout: this.timeout,
      // Try to use system Chrome if available to avoid architecture issues
      executablePath: process.env.CHROME_PATH || undefined
    };
  }

  /**
   * Check if a site needs browser fallback
   */
  needsBrowserFallback(url, cheerioResult) {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // Known sites that serve different content to bots
    const knownBotDetectionSites = [
      'olympicgmc.com',
      'dealeron.com',
      'frankmanmotors.com'
    ];

    // Use browser fallback if:
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
      console.log(`🎯 Browser fallback triggered for ${hostname}:`);
      if (isKnownSite) console.log(`   • Known bot detection site`);
      if (successfulButEmpty) console.log(`   • Many scripts but no Tealium found`);
      if (isForbidden) console.log(`   • HTTP 403 Forbidden (bot detection)`);
      if (isRateLimited) console.log(`   • HTTP 503 Rate Limited`);
    }

    return shouldUseFallback;
  }

  /**
   * Scan URL using real browser
   */
  async scanUrl(url, targetAccount, targetProfile = null, environment = 'prod', targetGtmContainer = null) {
    let browser = null;
    let page = null;

    const result = {
      url,
      timestamp: new Date().toISOString(),
      success: false,
      found: false,
      matches: false,
      details: {},
      scripts: [],
      summary: '',
      detection_method: 'browser_fallback',
      gtm: {
        found: false,
        matches: false,
        containers: [],
        details: {},
        summary: ''
      }
    };

    try {
      console.log(`🌐 Browser fallback: Launching Puppeteer for ${url}`);
      
      // Try launching with enhanced compatibility options
      try {
        browser = await puppeteer.launch(this.puppeteerOptions);
      } catch (launchError) {
        console.log(`⚠️ Primary launch failed, trying fallback options: ${launchError.message}`);
        
        // Fallback: Try with minimal options for compatibility
        const fallbackOptions = {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process'
          ],
          timeout: 30000
        };
        
        browser = await puppeteer.launch(fallbackOptions);
      }
      page = await browser.newPage();

      // Enhanced human-like spoofing setup
      await page.evaluateOnNewDocument(() => {
        // Remove all automation indicators
        delete Object.getPrototypeOf(navigator).webdriver;
        delete window.navigator.webdriver;
        delete window.navigator.__webdriver_script_fn;
        
        // Override webdriver getter
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // Mock realistic chrome object with more properties
        window.chrome = {
          runtime: {
            onConnect: undefined,
            onMessage: undefined,
            connect: function() { return {}; }
          },
          loadTimes: function() {
            return {
              connectionInfo: 'h2',
              finishDocumentLoadTime: performance.now() + Math.random() * 1000,
              finishLoadTime: performance.now() + Math.random() * 1500,
              firstPaintAfterLoadTime: 0,
              firstPaintTime: performance.now() + Math.random() * 500,
              navigationType: 'Navigation',
              npnNegotiatedProtocol: 'h2',
              requestTime: Date.now() - Math.random() * 3000,
              startLoadTime: performance.now() - Math.random() * 2000
            };
          },
          csi: function() {
            return {
              onloadT: Date.now(),
              startE: Date.now() - Math.random() * 5000,
              tran: Math.floor(Math.random() * 20)
            };
          },
          app: {
            isInstalled: false,
            InstallState: {DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed'},
            RunningState: {CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running'}
          }
        };
        
        // Mock plugins with realistic data
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            { name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
            { name: 'Chrome PDF Viewer', description: '', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
            { name: 'Native Client', description: '', filename: 'internal-nacl-plugin' }
          ]
        });
        
        // Mock realistic language settings
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        });
        
        // Mock hardware concurrency
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 8 + Math.floor(Math.random() * 8) // 8-16 cores
        });
        
        // Mock device memory
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8 + Math.floor(Math.random() * 24) // 8-32GB
        });
        
        // Mock permissions with proper responses
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => {
          const permissions = {
            'notifications': Promise.resolve({ state: 'default' }),
            'geolocation': Promise.resolve({ state: 'prompt' }),
            'camera': Promise.resolve({ state: 'prompt' }),
            'microphone': Promise.resolve({ state: 'prompt' })
          };
          return permissions[parameters.name] || originalQuery(parameters);
        };
        
        // Override Notification permission
        Object.defineProperty(Notification, 'permission', {
          get: () => 'default'
        });
        
        // Mock battery API
        if (!navigator.getBattery) {
          navigator.getBattery = () => Promise.resolve({
            charging: true,
            chargingTime: Infinity,
            dischargingTime: Infinity,
            level: 0.8 + Math.random() * 0.2 // 80-100%
          });
        }
        
        // Mock connection
        if (!navigator.connection) {
          Object.defineProperty(navigator, 'connection', {
            get: () => ({
              effectiveType: '4g',
              rtt: 50 + Math.random() * 50,
              downlink: 5 + Math.random() * 10,
              saveData: false
            })
          });
        }
      });

      // Set realistic browser environment with varied user agents
      const userAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      ];
      
      const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
      await page.setUserAgent(randomUA);
      await page.setViewport({ 
        width: 1920 + Math.floor(Math.random() * 100), 
        height: 1080 + Math.floor(Math.random() * 100) 
      });

      // Set realistic human-like headers
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"'
      });

      // Add some realistic browsing history simulation
      await page.evaluateOnNewDocument(() => {
        // Override screen properties with realistic values
        Object.defineProperty(screen, 'availTop', { get: () => 23 });
        Object.defineProperty(screen, 'availLeft', { get: () => 0 });
        Object.defineProperty(screen, 'availHeight', { get: () => 1057 });
        Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
        Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
        Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
        
        // Mock realistic timezone
        const timezoneOffset = new Date().getTimezoneOffset();
        Date.prototype.getTimezoneOffset = function() {
          return timezoneOffset;
        };
        
        // Add realistic performanceTiming
        if (window.performance && window.performance.timing) {
          const timing = window.performance.timing;
          const now = Date.now();
          Object.defineProperty(timing, 'navigationStart', { get: () => now - Math.random() * 5000 });
          Object.defineProperty(timing, 'loadEventEnd', { get: () => now - Math.random() * 1000 });
        }
      });

      // Navigate with enhanced strategy for bot-protected sites
      console.log(`📍 Navigating to: ${url}`);
      console.log(`⏱️ Navigation timeout set to: ${this.timeout}ms`);
      console.log(`🎯 Wait condition: domcontentloaded`);
      
      try {
        console.log(`🚀 Attempt 1: Standard navigation to ${url}`);
        const startTime = Date.now();
        
        // First try: Normal navigation
        await page.goto(url, { 
          waitUntil: 'domcontentloaded', // Less strict than networkidle2
          timeout: this.timeout 
        });
        
        const endTime = Date.now();
        console.log(`✅ Navigation successful in ${endTime - startTime}ms`);
        console.log(`🌐 Page loaded: ${await page.url()}`);
        console.log(`📄 Page title: ${await page.title()}`);
      } catch (timeoutError) {
        console.log(`⏱️ First navigation attempt timed out: ${timeoutError.message}`);
        console.log(`🔄 Trying alternative strategy with 'load' condition...`);
        
        // Second try: Navigate with minimal wait conditions
        try {
          console.log(`🚀 Attempt 2: Load condition navigation (30s timeout)`);
          const startTime2 = Date.now();
          
          await page.goto(url, { 
            waitUntil: 'load',
            timeout: 30000 // Shorter timeout for backup attempt
          });
          
          const endTime2 = Date.now();
          console.log(`✅ Alternative navigation successful in ${endTime2 - startTime2}ms`);
          console.log(`🌐 Page loaded: ${await page.url()}`);
        } catch (secondError) {
          console.log(`⏱️ Second navigation attempt failed: ${secondError.message}`);
          console.log(`🔄 Trying direct DOM access with 'commit' condition...`);
          
          try {
            console.log(`🚀 Attempt 3: Commit navigation (20s timeout)`);
            const startTime3 = Date.now();
            
            // Third try: Navigate without waiting for full load
            await page.goto(url, { 
              waitUntil: 'commit',
              timeout: 20000
            });
            
            const endTime3 = Date.now();
            console.log(`✅ Commit navigation successful in ${endTime3 - startTime3}ms`);
            console.log(`🌐 Page committed: ${await page.url()}`);
          } catch (thirdError) {
            console.log(`❌ All navigation attempts failed: ${thirdError.message}`);
            throw thirdError;
          }
        }
      }

      // Simulate realistic human behavior
      console.log(`👤 Simulating human behavior patterns...`);
      
      // Human-like mouse movement and interactions
      await this.simulateHumanBehavior(page);
      
      // Wait for dynamic content to load with multiple checks
      console.log(`⏱️ Waiting for dynamic scripts...`);
      
      // Wait for basic scripts to load
      await page.waitForTimeout(2000 + Math.random() * 2000); // Random 2-4 seconds
      
      // Simulate scrolling to trigger lazy loading
      await this.simulateScrolling(page);
      
      // Try to wait for specific elements that indicate the page is ready
      try {
        await page.waitForSelector('script', { timeout: 5000 });
      } catch (e) {
        console.log(`📄 Script elements not found quickly, proceeding with analysis...`);
      }
      
      // Additional wait for dynamic script injection
      await page.waitForTimeout(1000 + Math.random() * 2000); // Random 1-3 seconds

      // Extract all script information
      const scriptData = await page.evaluate(() => {
        const scripts = [];
        const scriptElements = document.querySelectorAll('script[src]');
        
        scriptElements.forEach(script => {
          scripts.push({
            src: script.src,
            async: script.async,
            defer: script.defer
          });
        });

        // Also extract inline scripts with Tealium patterns
        const inlineScripts = [];
        const inlineElements = document.querySelectorAll('script:not([src])');
        inlineElements.forEach(script => {
          const content = script.innerHTML;
          if (content.includes('tiqcdn') || content.includes('utag') || content.includes('tealium') ||
              content.includes('GTM-') || content.includes('googletagmanager')) {
            inlineScripts.push(content);
          }
        });

        return {
          external: scripts,
          inline: inlineScripts,
          totalScripts: scriptElements.length + inlineElements.length
        };
      });

      console.log(`📊 Browser found ${scriptData.external.length} external scripts, ${scriptData.inline.length} inline scripts with tag management`);
      
      result.scripts = scriptData.external.map(s => s.src);
      result.success = true;

      // Analyze for Tealium
      this.analyzeTealium(scriptData, result, targetAccount, targetProfile, environment);

      // Analyze for GTM
      this.analyzeGTM(scriptData, result, targetGtmContainer);

      // Generate summary
      if (result.matches) {
        result.summary = `✅ Found ${targetAccount} Tealium (browser detection)`;
        if (result.details.profile) {
          result.summary += ` (${result.details.profile})`;
        }
      } else if (result.found) {
        // Check if it's AdTaxi account - treat as success
        if (result.details.account === 'adtaxi') {
          result.summary = `✅ Found AdTaxi Tealium implementation (browser detection)`;
          if (result.details.profile) {
            result.summary = result.summary.replace('implementation', `account (${result.details.profile})`);
          }
        } else {
          result.summary = `⚠️ Different Tealium found: ${result.details.account || 'unknown'} (browser detection)`;
        }
      } else {
        result.summary = 'No Tealium found (browser detection)';
      }

      console.log(`✅ Browser scan complete: found=${result.found}, matches=${result.matches}`);

    } catch (error) {
      console.error(`❌ Browser fallback failed: ${error.message}`);
      result.success = false;
      result.error = error.message;
      result.summary = `❌ Browser detection failed: ${error.message}`;
    } finally {
      if (browser) {
        await browser.close();
        console.log(`🔒 Browser closed`);
      }
    }

    return result;
  }

  /**
   * Analyze script data for Tealium
   */
  analyzeTealium(scriptData, result, targetAccount, targetProfile, environment) {
    // Check external scripts
    const tealiumScripts = scriptData.external.filter(script => {
      const src = script.src.toLowerCase();
      return src.includes('tiqcdn.com') || 
             src.includes('utag.js') ||
             src.includes('tealium');
    });

    console.log(`🔍 Browser found ${tealiumScripts.length} external Tealium scripts`);

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
        
        const urlMatches = scriptContent.match(/['"](.*?tiqcdn\.com.*?utag\.js.*?)['"];?/g);
        if (urlMatches && !result.found) {
          result.found = true;
          
          urlMatches.forEach(match => {
            const cleanUrl = match.replace(/['"]/g, '').replace(/;$/, '');
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

    result.gtm.containers = Array.from(containerIds);
    result.gtm.found = result.gtm.containers.length > 0;

    if (result.gtm.found) {
      console.log(`📊 Browser found ${result.gtm.containers.length} GTM containers: ${result.gtm.containers.join(', ')}`);
      
      result.gtm.details.total_containers = result.gtm.containers.length;
      
      if (targetGtmContainer) {
        result.gtm.matches = result.gtm.containers.includes(targetGtmContainer);
        result.gtm.summary = result.gtm.matches 
          ? `✅ Found target GTM: ${targetGtmContainer}`
          : `⚠️ Target GTM not found. Found: ${result.gtm.containers.join(', ')}`;
      } else {
        result.gtm.matches = true;
        result.gtm.summary = `✅ Found ${result.gtm.containers.length} GTM containers (browser)`;
      }
    } else {
      result.gtm.summary = 'No GTM found (browser detection)';
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

  /**
   * Simulate realistic human behavior patterns
   */
  async simulateHumanBehavior(page) {
    try {
      // Random mouse movements
      await page.mouse.move(
        Math.random() * 1920, 
        Math.random() * 1080,
        { steps: Math.floor(Math.random() * 10) + 5 }
      );

      // Random short delay as humans pause
      await page.waitForTimeout(200 + Math.random() * 800);

      // Move to a different position
      await page.mouse.move(
        300 + Math.random() * 1320,
        200 + Math.random() * 680,
        { steps: Math.floor(Math.random() * 15) + 10 }
      );

      // Simulate thinking time
      await page.waitForTimeout(500 + Math.random() * 1500);

      // Occasional mouse click (not on important elements)
      if (Math.random() > 0.7) {
        await page.mouse.click(100 + Math.random() * 200, 100 + Math.random() * 200);
        await page.waitForTimeout(100 + Math.random() * 300);
      }

    } catch (error) {
      console.log(`⚠️ Human behavior simulation warning: ${error.message}`);
    }
  }

  /**
   * Simulate realistic scrolling patterns
   */
  async simulateScrolling(page) {
    try {
      // Scroll down in small increments like a human reading
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, Math.random() * 300 + 200);
        });
        
        // Human reading/scanning time
        await page.waitForTimeout(800 + Math.random() * 1200);
        
        // Sometimes scroll back up a bit (human behavior)
        if (Math.random() > 0.8) {
          await page.evaluate(() => {
            window.scrollBy(0, -(Math.random() * 100 + 50));
          });
          await page.waitForTimeout(300 + Math.random() * 500);
        }
      }

      // Scroll to different positions
      const scrollPositions = [0, 0.3, 0.6, 0.8, 0];
      
      for (const position of scrollPositions) {
        await page.evaluate((pos) => {
          window.scrollTo(0, document.body.scrollHeight * pos);
        }, position);
        
        // Realistic pause between scrolls
        await page.waitForTimeout(400 + Math.random() * 800);
      }

    } catch (error) {
      console.log(`⚠️ Scrolling simulation warning: ${error.message}`);
    }
  }

  /**
   * Add realistic timing variations
   */
  async humanDelay(baseMs = 1000, variationMs = 500) {
    const delay = baseMs + (Math.random() * variationMs);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

export default BrowserFallback;