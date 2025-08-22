import axios from 'axios';
import { load } from 'cheerio';

/**
 * Cheerio-based Tealium detector
 * Lightweight alternative to Puppeteer that works on any architecture
 */
export class CheerioDetector {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.useEnhancedBrowserMimicking = options.useEnhancedBrowserMimicking !== false; // Default to true
  }

  /**
   * Scan a URL for Tealium implementation and GTM containers
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
      // Ensure URL has protocol
      const normalizedUrl = this.normalizeUrl(url);
      
      console.log(`Fetching: ${normalizedUrl}`);
      
      // Fetch the HTML with enhanced browser mimicking and retry logic
      const response = await this.fetchWithRetry(normalizedUrl);

      console.log(`✅ HTTP ${response.status}: ${normalizedUrl}`);
      
      // Parse HTML with Cheerio
      const $ = load(response.data);
      
      // Extract all script sources
      const scriptElements = $('script[src]').toArray();
      const scripts = scriptElements.map(el => $(el).attr('src')).filter(Boolean);
      
      result.scripts = scripts;
      result.success = true;

      console.log(`Found ${scripts.length} script tags`);

      // Find Tealium scripts in external scripts with more aggressive detection
      const tealiumScripts = scripts.filter(src => {
        const srcLower = (src || '').toLowerCase();
        return srcLower.includes('tiqcdn.com') || 
               srcLower.includes('utag.js') ||
               srcLower.includes('tealium') ||
               srcLower.match(/utag.*\.js/) ||
               srcLower.includes('tags.tiqcdn')
      });

      console.log(`Found ${tealiumScripts.length} potential Tealium scripts`);
      
      // ENHANCED: Also check if any script sources might be malformed or partial
      const allScriptSources = scriptElements.map(el => {
        const src = $(el).attr('src');
        const innerHTML = $(el).html();
        return { src, innerHTML, element: $(el).toString() };
      });
      
      // Look for Tealium references in script elements themselves
      const hiddenTealiumScripts = allScriptSources.filter(script => {
        const combined = `${script.src || ''} ${script.innerHTML || ''} ${script.element || ''}`.toLowerCase();
        return combined.includes('tiqcdn') || 
               combined.includes('utag') || 
               combined.includes('tealium');
      });
      
      if (hiddenTealiumScripts.length > 0) {
        console.log(`🔍 Found ${hiddenTealiumScripts.length} additional Tealium references in script elements:`, 
                   hiddenTealiumScripts.map(s => s.element));
        hiddenTealiumScripts.forEach(script => {
          if (script.src) {
            tealiumScripts.push(script.src);
          }
        });
      }

      // ENHANCEMENT: Also check inline scripts for dynamic Tealium loading
      const inlineScripts = $('script:not([src])').toArray();
      const inlineScriptTexts = inlineScripts.map(script => $(script).html() || '');
      
      console.log(`Checking ${inlineScripts.length} inline scripts for dynamic Tealium loading...`);
      
      // Look for Tealium references in inline scripts with enhanced pattern detection
      const dynamicTealiumScripts = [];
      inlineScriptTexts.forEach((scriptText, index) => {
        const scriptLower = scriptText.toLowerCase();
        if (scriptLower.includes('tiqcdn.com') || 
            scriptLower.includes('utag.js') || 
            scriptLower.includes('utag_data') ||
            scriptLower.includes('tealium') ||
            scriptLower.includes('tags.tiqcdn') ||
            scriptLower.match(/createElement.*script.*utag/) ||
            scriptLower.match(/src.*=.*utag/) ||
            // Look for dynamic script creation patterns
            scriptLower.match(/script.*src.*tiqcdn/) ||
            scriptLower.match(/appendChild.*utag/) ||
            scriptLower.match(/insertbefore.*utag/)) {
          
          console.log(`🔍 Inline script ${index + 1} contains Tealium references (${scriptText.length} chars)`);
          
          // Enhanced extraction patterns
          
          // Extract Tealium script URLs from inline JavaScript
          const tiqcdnMatches = scriptText.match(/['"](.*?tiqcdn\.com.*?utag\.js.*?)['"];?/g);
          if (tiqcdnMatches) {
            tiqcdnMatches.forEach(match => {
              // Clean up the matched string
              const cleanUrl = match.replace(/['"]/g, '').replace(/;$/, '');
              // Add protocol if missing
              const fullUrl = cleanUrl.startsWith('//') ? `https:${cleanUrl}` : cleanUrl;
              dynamicTealiumScripts.push(fullUrl);
              console.log(`Found dynamic Tealium script: ${fullUrl}`);
            });
          }
        }
      });

      // Combine external and dynamic scripts
      let allTealiumScripts = [...tealiumScripts, ...dynamicTealiumScripts];
      
      // ADDITIONAL: Full document text search as fallback
      const fullHtml = response.data;
      const fullHtmlLower = fullHtml.toLowerCase();
      
      if ((fullHtmlLower.includes('tiqcdn') || fullHtmlLower.includes('utag') || fullHtmlLower.includes('tealium')) && 
          allTealiumScripts.length === 0) {
        console.log(`⚠️ Document contains Tealium references but no scripts detected - checking for missed patterns`);
        
        // Look for script tags that might have been missed
        const scriptMatches = fullHtml.match(/<script[^>]*src[^>]*tiqcdn[^>]*>/gi) || [];
        const utagMatches = fullHtml.match(/<script[^>]*src[^>]*utag[^>]*>/gi) || [];
        const allMatches = [...scriptMatches, ...utagMatches];
        
        if (allMatches.length > 0) {
          console.log(`🔍 Found ${allMatches.length} Tealium script tags via text search:`, allMatches);
          
          // Extract URLs from these matches
          allMatches.forEach(match => {
            const srcMatch = match.match(/src=['"]([^'"]*)['"]/i);
            if (srcMatch && srcMatch[1]) {
              let url = srcMatch[1];
              // Add protocol if missing
              if (url.startsWith('//')) url = `https:${url}`;
              allTealiumScripts.push(url);
              console.log(`📍 Added missed Tealium script: ${url}`);
            }
          });
        }
      }
      
      console.log(`Total Tealium scripts found: ${allTealiumScripts.length} (${tealiumScripts.length} external + ${dynamicTealiumScripts.length} dynamic)`);

      if (allTealiumScripts.length === 0) {
        result.summary = 'No Tealium implementation detected';
        // Don't return early - we still need to check for GTM!
      } else {
        result.found = true;
      }

      // Analyze each Tealium script (only if we found any)
      let matchFound = false;
      const detectedDetails = {};

      if (allTealiumScripts.length > 0) {
        for (const scriptSrc of allTealiumScripts) {
          console.log(`Analyzing script: ${scriptSrc}`);
          
          const analysis = this.analyzeTealiumScript(scriptSrc);
          
          if (analysis.account) {
            detectedDetails.account = analysis.account;
            detectedDetails.profile = analysis.profile;
            detectedDetails.environment = analysis.environment;
            
            // Extract version information
            if (analysis.tealiumVersion) detectedDetails.tealium_version = analysis.tealiumVersion;
            if (analysis.buildVersion) detectedDetails.build_version = analysis.buildVersion;
            if (analysis.utag_major_version) detectedDetails.utag_major_version = analysis.utag_major_version;
            if (analysis.utag_minor_version) detectedDetails.utag_minor_version = analysis.utag_minor_version;
            if (analysis.publish_date) detectedDetails.publish_date = analysis.publish_date;
            if (analysis.profile_build_date) detectedDetails.profile_build_date = analysis.profile_build_date;

            console.log(`Detected account: ${analysis.account}, profile: ${analysis.profile}, env: ${analysis.environment}`);
            
            // Check if this matches our target
            const accountMatches = analysis.account === targetAccount;
            const profileMatches = !targetProfile || analysis.profile === targetProfile;
            const environmentMatches = analysis.environment === environment;

            if (accountMatches && profileMatches && environmentMatches) {
              matchFound = true;
              console.log(`✅ Match found!`);
            }
          }
        }
      }

      result.details = detectedDetails;
      result.matches = matchFound;

      // GTM Detection
      const gtmResults = this.detectGTM($, targetGtmContainer);
      result.gtm = gtmResults;

      // Relationship Analysis (Tag Placement Methodology)
      result.relationship = this.analyzeTagRelationship(result, gtmResults, $);

      // Generate summary
      if (matchFound) {
        result.summary = `✅ Found ${targetAccount} Tealium account`;
        if (detectedDetails.profile) {
          result.summary += ` (${detectedDetails.profile})`;
        }
        if (detectedDetails.tealium_version) {
          result.summary += ` - Version ${detectedDetails.tealium_version}`;
        }
      } else if (result.found) {
        // Check if it's AdTaxi account - treat as success
        if (detectedDetails.account === 'adtaxi') {
          result.summary = `✅ Found AdTaxi Tealium account`;
          if (detectedDetails.profile) {
            result.summary += ` (${detectedDetails.profile})`;
          }
          if (detectedDetails.tealium_version) {
            result.summary += ` - Version ${detectedDetails.tealium_version}`;
          }
        } else {
          result.summary = `⚠️ Found different Tealium account: ${detectedDetails.account || 'unknown'}`;
          if (detectedDetails.profile) {
            result.summary += ` (${detectedDetails.profile})`;
          }
        }
      }

    } catch (error) {
      console.error(`❌ Error scanning ${url}:`, error.message);
      
      result.success = false;
      result.error = error.message;
      
      // Generate verbose error messages
      result.verboseError = this.generateVerboseError(error, url);
      
      if (error.code === 'ENOTFOUND') {
        result.summary = `❌ Domain not found: ${url}`;
      } else if (error.code === 'ECONNREFUSED') {
        result.summary = `❌ Connection refused: ${url}`;
      } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        result.summary = `❌ Request timeout: ${url}`;
      } else if (error.response?.status >= 400) {
        result.summary = `❌ HTTP ${error.response.status}: ${url}`;
      } else {
        result.summary = `❌ Error: ${error.message}`;
      }
    }

    return result;
  }

  /**
   * Scan multiple URLs
   */
  async scanUrls(urls, targetAccount, targetProfile = null, environment = 'prod', targetGtmContainer = null) {
    console.log(`Scanning ${urls.length} URLs for account: ${targetAccount}`);
    
    const results = [];
    
    for (const url of urls) {
      try {
        const result = await this.scanUrl(url, targetAccount, targetProfile, environment, targetGtmContainer);
        results.push(result);
        
        // Brief pause between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 500));
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
    
    return results;
  }

  /**
   * Normalize URL format
   */
  normalizeUrl(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }

  /**
   * Analyze Tealium script URL to extract account, profile, environment
   */
  analyzeTealiumScript(scriptSrc) {
    const analysis = {
      account: null,
      profile: null,
      environment: null,
      tealiumVersion: null,
      buildVersion: null,
      utag_major_version: null,
      utag_minor_version: null,
      publish_date: null,
      profile_build_date: null
    };

    // Standard Tealium URL pattern: https://tags.tiqcdn.com/utag/ACCOUNT/PROFILE/ENVIRONMENT/utag.js
    const tealiumRegex = /https?:\/\/tags\.tiqcdn\.com\/utag\/([^\/]+)\/([^\/]+)\/([^\/]+)\/utag\.js/;
    const match = scriptSrc.match(tealiumRegex);

    if (match) {
      analysis.account = match[1];
      analysis.profile = match[2];
      analysis.environment = match[3];
    }

    // Extract version information from URL parameters (with error handling)
    try {
      const url = new URL(scriptSrc);
      
      // Extract utv parameter (Tealium version)
      const utv = url.searchParams.get('utv');
      if (utv) {
        // Parse version format like "ut4.46.202301091855"
        const versionMatch = utv.match(/ut(\d+)\.(\d+)\.(\d+)/);
        if (versionMatch) {
          analysis.utag_major_version = versionMatch[1];
          analysis.utag_minor_version = versionMatch[2];
          analysis.build_version = versionMatch[3];
          analysis.tealium_version = `${versionMatch[1]}.${versionMatch[2]}`;
          
          // Extract date from build version (YYYYMMDDHHMM format)
          const buildDate = versionMatch[3];
          if (buildDate.length >= 8) {
            const year = buildDate.substring(0, 4);
            const month = buildDate.substring(4, 6);
            const day = buildDate.substring(6, 8);
            analysis.profile_build_date = `${year}-${month}-${day}`;
          }
        }
      }
    } catch (urlError) {
      console.log(`⚠️ Could not parse URL parameters from: ${scriptSrc} (${urlError.message})`);
      // Continue without version info - the essential account/profile/environment was already extracted above
    }

    return analysis;
  }

  /**
   * Generate verbose error message for troubleshooting
   */
  generateVerboseError(error, url) {
    let verbose = `Detailed error information for: ${url}\n\n`;
    
    verbose += `Error type: ${error.code || error.name || 'Unknown'}\n`;
    verbose += `Error message: ${error.message}\n\n`;

    if (error.code === 'ENOTFOUND') {
      verbose += `DNS Resolution Failed:\n`;
      verbose += `• The domain name could not be resolved\n`;
      verbose += `• Check if the website URL is correct\n`;
      verbose += `• Try accessing the site in your browser\n\n`;
      verbose += `Suggestions:\n`;
      verbose += `• Verify the domain spelling\n`;
      verbose += `• Check your internet connection\n`;
      verbose += `• Try with 'www.' prefix if not present\n`;
    } else if (error.code === 'ECONNREFUSED') {
      verbose += `Connection Refused:\n`;
      verbose += `• The server is not accepting connections on this port\n`;
      verbose += `• The website may be down or blocking requests\n\n`;
      verbose += `Suggestions:\n`;
      verbose += `• Check if the website is accessible in your browser\n`;
      verbose += `• The site may be blocking automated requests\n`;
      verbose += `• Try again later as the server may be temporarily down\n`;
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      verbose += `Request Timeout:\n`;
      verbose += `• The request took longer than ${this.timeout}ms to complete\n`;
      verbose += `• The server is responding slowly or not at all\n\n`;
      verbose += `Suggestions:\n`;
      verbose += `• Try again as this may be a temporary issue\n`;
      verbose += `• The website may be experiencing high load\n`;
      verbose += `• Check your internet connection speed\n`;
    } else if (error.response) {
      verbose += `HTTP Error ${error.response.status}:\n`;
      if (error.response.status === 403) {
        verbose += `• Access forbidden - the server is blocking this request\n`;
        verbose += `• The website may have anti-bot protection\n`;
      } else if (error.response.status === 404) {
        verbose += `• Page not found - the URL may be incorrect\n`;
        verbose += `• The website may have moved or been removed\n`;
      } else if (error.response.status >= 500) {
        verbose += `• Server error - the website is experiencing issues\n`;
        verbose += `• This is a temporary problem with the website\n`;
      }
      verbose += `\nSuggestions:\n`;
      verbose += `• Verify the URL is correct\n`;
      verbose += `• Try accessing the page directly in your browser\n`;
      verbose += `• Try again later if it's a server error\n`;
    }

    return verbose;
  }

  /**
   * Detect Google Tag Manager containers
   */
  detectGTM($, targetGtmContainer = null) {
    const result = {
      found: false,
      matches: false,
      containers: [],
      details: {},
      summary: ''
    };

    console.log('🏷️ Detecting Google Tag Manager containers...');

    // Method 1: Look for GTM script tags in external scripts
    const scriptElements = $('script[src]').toArray();
    const scripts = scriptElements.map(el => $(el).attr('src')).filter(Boolean);
    
    console.log(`📊 Found ${scriptElements.length} external script tags`);
    console.log(`📝 External scripts:`, scripts);
    
    const gtmScripts = scripts.filter(src => {
      const srcLower = (src || '').toLowerCase();
      return srcLower.includes('googletagmanager.com/gtag/js') ||
             srcLower.includes('googletagmanager.com/gtm.js') ||
             srcLower.includes('googletagmanager.com/ns.html') ||
             srcLower.includes('gtag/js?id=') ||
             srcLower.includes('gtm.js?id=') ||
             srcLower.match(/gtag.*\.js/) ||
             srcLower.match(/gtm.*\.js/) ||
             srcLower.includes('google-analytics.com/analytics.js') ||
             srcLower.includes('google-analytics.com/ga.js');
    });

    console.log(`🎯 Found ${gtmScripts.length} GTM-related external scripts:`, gtmScripts);

    // Method 2: Look for inline GTM scripts
    const inlineScripts = $('script:not([src])').toArray();
    const inlineScriptTexts = inlineScripts.map(script => $(script).html() || '');
    
    console.log(`📄 Found ${inlineScripts.length} inline script tags`);
    console.log(`🔍 Analyzing inline scripts for GTM patterns...`);
    
    const containerIds = new Set();
    
    // Extract container IDs from external scripts
    gtmScripts.forEach(src => {
      // Precise GTM container pattern matching
      const gtmMatch = src.match(/[?&]id=(GTM-[A-Z0-9]{7})\b/i); // Exactly 7 chars
      const gtagMatch = src.match(/[?&]id=(G-[A-Z0-9]{10})\b/i); // Exactly 10 chars
      const uaMatch = src.match(/[?&]id=(UA-[0-9]+-[0-9]+)\b/i); // Numbers-numbers format
      const adWordsMatch = src.match(/[?&]id=(AW-[0-9]+)\b/i); // Numbers only after AW-
      
      if (gtmMatch) {
        containerIds.add(gtmMatch[1].toUpperCase());
        console.log(`Found GTM container from script: ${gtmMatch[1].toUpperCase()}`);
      }
      if (gtagMatch) {
        containerIds.add(gtagMatch[1].toUpperCase());
        console.log(`Found GA4 container from script: ${gtagMatch[1].toUpperCase()}`);
      }
      if (uaMatch) {
        containerIds.add(uaMatch[1].toUpperCase());
        console.log(`Found Universal Analytics from script: ${uaMatch[1].toUpperCase()}`);
      }
      if (adWordsMatch) {
        containerIds.add(adWordsMatch[1].toUpperCase());
        console.log(`Found Google Ads conversion from script: ${adWordsMatch[1].toUpperCase()}`);
      }
    });

    // Extract container IDs from inline scripts
    inlineScriptTexts.forEach((scriptText, index) => {
      console.log(`\n🔬 Analyzing inline script ${index + 1}/${inlineScriptTexts.length} (${scriptText.length} chars)...`);
      
      if (scriptText.includes('GTM-') || scriptText.includes('googletagmanager')) {
        console.log(`   🎯 Script contains GTM-related content`);
        if (scriptText.length < 500) {
          console.log(`   📝 Script content:`, scriptText.substring(0, 200) + (scriptText.length > 200 ? '...' : ''));
        }
      } else {
        console.log(`   ⚪ Script does not contain GTM patterns`);
      }

      // Method 1: Look for GTM container IDs directly in quotes (GTM-XXXXXXX)
      const gtmMatches = scriptText.match(/['"`]GTM-[A-Z0-9]{7}['"`]/gi);
      if (gtmMatches) {
        console.log(`   ✅ Method 1 - Found quoted GTM IDs:`, gtmMatches);
        gtmMatches.forEach(match => {
          const containerId = match.replace(/['"`]/g, '').toUpperCase();
          containerIds.add(containerId);
          console.log(`   ➕ Added GTM container from inline script: ${containerId}`);
        });
      }

      // Method 2: Look for GTM IIFE pattern - handle multiline scripts
      // Look for the specific pattern: })(window,document,'script','dataLayer','GTM-XXXXX');
      if (scriptText.includes('window,document,') && scriptText.includes('dataLayer') && scriptText.includes('GTM-')) {
        console.log(`   ✅ Method 2 - Script contains IIFE pattern indicators`);
        // Extract everything after dataLayer until the end of the function call
        const dataLayerIndex = scriptText.lastIndexOf('dataLayer');
        if (dataLayerIndex !== -1) {
          const afterDataLayer = scriptText.substring(dataLayerIndex);
          console.log(`   📍 Analyzing after dataLayer: "${afterDataLayer.substring(0, 100)}..."`);
          const gtmMatches = afterDataLayer.match(/GTM-[A-Z0-9]{7}/g);
          if (gtmMatches) {
            console.log(`   ✅ Method 2 - Found GTM IDs in IIFE pattern:`, gtmMatches);
            gtmMatches.forEach(containerId => {
              containerIds.add(containerId.toUpperCase());
              console.log(`   ➕ Added GTM container from IIFE pattern: ${containerId.toUpperCase()}`);
            });
          }
        }
      }

      // Method 3: Look for GTM function parameter patterns like ...,'GTM-XXXXX');
      const functionParamMatches = scriptText.match(/,\s*['"]GTM-[A-Z0-9]{7}['"],?\s*\)/gi);
      if (functionParamMatches) {
        functionParamMatches.forEach(match => {
          const gtmMatch = match.match(/['"]GTM-[A-Z0-9]{7}['"]/i);
          if (gtmMatch) {
            const containerId = gtmMatch[0].replace(/['"`]/g, '').toUpperCase();
            containerIds.add(containerId);
            console.log(`Found GTM container from function parameter: ${containerId}`);
          }
        });
      }

      // Method 4: Look for GTM URL construction patterns 'gtm.js?id='+i where i is GTM ID
      if (scriptText.includes('gtm.js?id=') || scriptText.includes('googletagmanager.com')) {
        // Look for variable assignments that might contain GTM IDs
        const variableMatches = scriptText.match(/[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*['"]GTM-[A-Z0-9]{7}['"]/gi);
        if (variableMatches) {
          variableMatches.forEach(match => {
            const gtmMatch = match.match(/['"]GTM-[A-Z0-9]{7}['"]/i);
            if (gtmMatch) {
              const containerId = gtmMatch[0].replace(/['"`]/g, '').toUpperCase();
              containerIds.add(containerId);
              console.log(`Found GTM container from variable assignment: ${containerId}`);
            }
          });
        }
      }

      // Method 5: Look for GA4 measurement IDs (G-XXXXXXXXXX) and other Google tracking IDs
      const ga4Matches = scriptText.match(/['"`]G-[A-Z0-9]{10}['"`]/gi);
      if (ga4Matches) {
        ga4Matches.forEach(match => {
          const measurementId = match.replace(/['"`]/g, '').toUpperCase();
          containerIds.add(measurementId);
          console.log(`Found GA4 measurement ID from inline script: ${measurementId}`);
        });
      }

      // Method 5b: Look for Universal Analytics IDs (UA-XXXXXXX-X)
      const uaMatches = scriptText.match(/['"`]UA-[0-9]+-[0-9]+['"`]/gi);
      if (uaMatches) {
        uaMatches.forEach(match => {
          const trackingId = match.replace(/['"`]/g, '').toUpperCase();
          containerIds.add(trackingId);
          console.log(`Found Universal Analytics ID from inline script: ${trackingId}`);
        });
      }

      // Method 5c: Look for Google Ads conversion tracking (AW-XXXXXXX)
      const awMatches = scriptText.match(/['"`]AW-[0-9]+['"`]/gi);
      if (awMatches) {
        awMatches.forEach(match => {
          const conversionId = match.replace(/['"`]/g, '').toUpperCase();
          containerIds.add(conversionId);
          console.log(`Found Google Ads conversion ID from inline script: ${conversionId}`);
        });
      }

      // Method 6: Look for gtag('config', 'container-id') patterns
      const gtagConfigMatches = scriptText.match(/gtag\s*\(\s*['"]config['"],\s*['"]([^'"]+)['"]/g);
      if (gtagConfigMatches) {
        gtagConfigMatches.forEach(match => {
          const configMatch = match.match(/['"]([^'"]+)['"]$/);
          if (configMatch) {
            containerIds.add(configMatch[1]);
            console.log(`Found container from gtag config: ${configMatch[1]}`);
          }
        });
      }

      // Method 7: Precise fallback - only valid Google property formats
      // GTM containers: GTM-XXXXXXX (exactly 7 alphanumeric chars after GTM-)
      const fallbackGtmMatches = scriptText.match(/\bGTM-[A-Z0-9]{7}\b/gi);
      if (fallbackGtmMatches) {
        fallbackGtmMatches.forEach(containerId => {
          const normalizedId = containerId.toUpperCase();
          if (!containerIds.has(normalizedId)) {
            containerIds.add(normalizedId);
            console.log(`Found GTM container (fallback method): ${normalizedId}`);
          }
        });
      }

      // GA4 measurement IDs: G-XXXXXXXXXX (exactly 10 alphanumeric chars after G-)
      const fallbackGa4Matches = scriptText.match(/\bG-[A-Z0-9]{10}\b/gi);
      if (fallbackGa4Matches) {
        fallbackGa4Matches.forEach(measurementId => {
          const normalizedId = measurementId.toUpperCase();
          if (!containerIds.has(normalizedId)) {
            containerIds.add(normalizedId);
            console.log(`Found GA4 measurement ID (fallback method): ${normalizedId}`);
          }
        });
      }

      // Universal Analytics: UA-XXXXXXX-X (numbers-numbers format)
      const fallbackUaMatches = scriptText.match(/\bUA-[0-9]+-[0-9]+\b/gi);
      if (fallbackUaMatches) {
        fallbackUaMatches.forEach(trackingId => {
          const normalizedId = trackingId.toUpperCase();
          if (!containerIds.has(normalizedId)) {
            containerIds.add(normalizedId);
            console.log(`Found Universal Analytics ID (fallback method): ${normalizedId}`);
          }
        });
      }

      // Google Ads conversion: AW-XXXXXXX (numbers only after AW-)
      const fallbackAwMatches = scriptText.match(/\bAW-[0-9]+\b/gi);
      if (fallbackAwMatches) {
        fallbackAwMatches.forEach(conversionId => {
          const normalizedId = conversionId.toUpperCase();
          if (!containerIds.has(normalizedId)) {
            containerIds.add(normalizedId);
            console.log(`Found Google Ads conversion ID (fallback method): ${normalizedId}`);
          }
        });
      }
    });

    // Method 3: Look for GTM noscript tags
    const noscriptElements = $('noscript').toArray();
    noscriptElements.forEach(noscript => {
      const content = $(noscript).html() || '';
      const gtmMatches = content.match(/\bGTM-[A-Z0-9]{7}\b/gi);
      if (gtmMatches) {
        gtmMatches.forEach(containerId => {
          containerIds.add(containerId.toUpperCase());
          console.log(`Found GTM container from noscript: ${containerId.toUpperCase()}`);
        });
      }
    });

    // Convert Set to Array and analyze results
    result.containers = Array.from(containerIds);
    result.found = result.containers.length > 0;

    console.log(`\n📊 GTM Detection Summary:`);
    console.log(`   📦 Total unique containers found: ${result.containers.length}`);
    console.log(`   🏷️  Container IDs: [${result.containers.join(', ')}]`);

    if (result.found) {
      console.log(`✅ GTM Detection SUCCESS: Found ${result.containers.length} containers`);
      
      result.details = {
        total_containers: result.containers.length,
        container_types: this.categorizeContainers(result.containers),
        containers: result.containers
      };

      const types = result.details.container_types;
      console.log(`   🔖 Container breakdown:`);
      console.log(`      • GTM Containers: ${types.gtm.length} [${types.gtm.join(', ')}]`);
      console.log(`      • GA4 Properties: ${types.ga4.length} [${types.ga4.join(', ')}]`);
      console.log(`      • Universal Analytics: ${types.universal_analytics.length} [${types.universal_analytics.join(', ')}]`);
      console.log(`      • Google Ads: ${types.google_ads.length} [${types.google_ads.join(', ')}]`);
      console.log(`      • Other IDs: ${types.other.length} [${types.other.join(', ')}]`);

      // Check if we have a target container to match
      if (targetGtmContainer) {
        result.matches = result.containers.includes(targetGtmContainer);
        console.log(`🎯 Target container '${targetGtmContainer}': ${result.matches ? '✅ FOUND' : '❌ NOT FOUND'}`);
        if (result.matches) {
          result.summary = `✅ Found target GTM container: ${targetGtmContainer}`;
        } else {
          result.summary = `⚠️ Target container ${targetGtmContainer} not found. Found: ${result.containers.join(', ')}`;
        }
      } else {
        // No specific target - show all found containers
        result.matches = true; // Consider it a match if we found any containers
        console.log(`🔍 No specific target - considering all found containers as matches`);
        if (result.containers.length === 1) {
          result.summary = `✅ Found GTM container: ${result.containers[0]}`;
        } else {
          result.summary = `✅ Found ${result.containers.length} containers: ${result.containers.join(', ')}`;
        }
      }
    } else {
      console.log(`❌ GTM Detection FAILED: No containers found`);
      result.summary = 'No GTM containers detected';
      
      // Ensure consistent structure even when no containers are found
      result.details = {
        total_containers: 0,
        container_types: { gtm: [], ga4: [], universal_analytics: [], google_ads: [], other: [] },
        containers: []
      };
      
      if (targetGtmContainer) {
        result.summary = `❌ Target container ${targetGtmContainer} not found`;
        console.log(`🎯 Target container '${targetGtmContainer}': ❌ NOT FOUND (no containers detected)`);
      }
    }

    return result;
  }

  /**
   * Categorize container IDs by type
   */
  categorizeContainers(containers) {
    const types = {
      gtm: [],
      ga4: [],
      universal_analytics: [],
      google_ads: [],
      other: []
    };

    containers.forEach(container => {
      if (container.startsWith('GTM-')) {
        types.gtm.push(container);
      } else if (container.startsWith('G-')) {
        types.ga4.push(container);
      } else if (container.startsWith('UA-')) {
        types.universal_analytics.push(container);
      } else if (container.startsWith('AW-')) {
        types.google_ads.push(container);
      } else {
        types.other.push(container);
      }
    });

    return types;
  }

  /**
   * Analyze tag placement methodology and implementation patterns
   */
  analyzeTagRelationship(tealiumResult, gtmResult, $) {
    console.log('🔧 Analyzing Tag Placement Methodology...');
    
    const placement = {
      methodology: 'unknown',
      analysis: '',
      recommendations: [],
      patterns: {
        direct_placement: [],
        tag_manager_placement: [],
        nested_placement: [],
        hybrid_placement: []
      },
      loading_patterns: {
        synchronous: [],
        asynchronous: [],
        deferred: []
      },
      technical_details: {}
    };

    // Analyze Tealium placement patterns
    if (tealiumResult.found) {
      placement.patterns.tag_manager_placement.push({
        system: 'Tealium',
        account: tealiumResult.details.account,
        profile: tealiumResult.details.profile,
        environment: tealiumResult.details.environment,
        implementation_type: this.analyzeTealiumImplementation(tealiumResult),
        loading_pattern: this.analyzeLoadingPattern(tealiumResult.scripts, $)
      });
    }

    // Analyze GTM placement patterns
    if (gtmResult.found) {
      placement.patterns.tag_manager_placement.push({
        system: 'Google Tag Manager',
        containers: gtmResult.containers,
        container_types: gtmResult.details.container_types,
        implementation_type: this.analyzeGTMImplementation(gtmResult),
        loading_pattern: this.analyzeLoadingPattern(gtmResult.containers, $)
      });
    }

    // Analyze direct tag placement (non-tag manager tags)
    placement.patterns.direct_placement = this.analyzeDirectTagPlacement($);

    // Check for nested implementations (GTM within Tealium, etc.)
    placement.patterns.nested_placement = this.analyzeNestedImplementations(tealiumResult, gtmResult, $);

    // Determine overall methodology
    placement.methodology = this.determineTagMethodology(tealiumResult, gtmResult);
    placement.analysis = this.generatePlacementAnalysis(placement);
    placement.recommendations = this.generatePlacementRecommendations(placement);

    console.log(`   🏗️ Placement methodology: ${placement.methodology}`);
    console.log(`   📊 Tag managers found: ${placement.patterns.tag_manager_placement.length}`);
    console.log(`   💡 Recommendations: ${placement.recommendations.length}`);

    return placement;
  }

  /**
   * Analyze Tealium implementation methodology
   */
  analyzeTealiumImplementation(tealiumResult) {
    if (!tealiumResult.found) return 'none';

    const scripts = tealiumResult.scripts || [];
    const hasExternalScript = scripts.some(script => script.includes('utag.js'));
    const hasInlineScript = tealiumResult.dynamic_loading || false;

    if (hasExternalScript && hasInlineScript) {
      return 'hybrid_static_dynamic';
    } else if (hasExternalScript) {
      return 'static_script_tag';
    } else if (hasInlineScript) {
      return 'dynamic_loading';
    }
    
    return 'custom_implementation';
  }

  /**
   * Analyze GTM implementation methodology
   */
  analyzeGTMImplementation(gtmResult) {
    if (!gtmResult.found) return 'none';

    const containers = gtmResult.containers || [];
    const types = gtmResult.details?.container_types || {};
    
    const hasGTM = types.gtm?.length > 0;
    const hasGA4 = types.ga4?.length > 0;
    const hasUA = types.universal_analytics?.length > 0;
    const hasAW = types.google_ads?.length > 0;

    if (hasGTM && (hasGA4 || hasUA || hasAW)) {
      return 'gtm_with_direct_tags';
    } else if (hasGTM) {
      return 'gtm_container_only';
    } else if (hasGA4 || hasUA || hasAW) {
      return 'direct_google_tags';
    }

    return 'unknown_google_implementation';
  }

  /**
   * Analyze loading patterns for scripts - enhanced with DOM analysis
   */
  analyzeLoadingPattern(scripts, $) {
    if (!scripts || scripts.length === 0) return 'none';

    const patterns = {
      synchronous: [],
      asynchronous: [],
      deferred: [],
      dynamic: []
    };

    // If we have access to the DOM ($), analyze script attributes
    if ($) {
      $('script[src]').each((index, element) => {
        const src = $(element).attr('src');
        const async = $(element).attr('async');
        const defer = $(element).attr('defer');
        
        // Check if this script is one of our tracked scripts
        const isTrackedScript = scripts.some(script => 
          typeof script === 'string' ? script.includes(src) : false
        );

        if (isTrackedScript) {
          if (defer !== undefined) {
            patterns.deferred.push(src);
          } else if (async !== undefined) {
            patterns.asynchronous.push(src);
          } else {
            patterns.synchronous.push(src);
          }
        }
      });

      // Check for dynamically loaded scripts in inline JavaScript
      $('script:not([src])').each((index, element) => {
        const content = $(element).html() || '';
        if (content.includes('createElement') && content.includes('script')) {
          patterns.dynamic.push('Dynamic script loading detected');
        }
      });
    }

    // Determine primary loading pattern
    if (patterns.dynamic.length > 0) return 'dynamic_loading';
    if (patterns.asynchronous.length > 0) return 'asynchronous';
    if (patterns.deferred.length > 0) return 'deferred';
    if (patterns.synchronous.length > 0) return 'synchronous';

    return 'unknown';
  }

  /**
   * Determine overall tag methodology
   */
  determineTagMethodology(tealiumResult, gtmResult) {
    const hasTealium = tealiumResult.found;
    const hasGTM = gtmResult.found;

    if (!hasTealium && !hasGTM) {
      return 'no_tag_management';
    } else if (hasTealium && !hasGTM) {
      return 'tealium_managed';
    } else if (!hasTealium && hasGTM) {
      return 'gtm_managed';
    } else {
      return 'dual_tag_managers';
    }
  }

  /**
   * Generate placement analysis description
   */
  generatePlacementAnalysis(placement) {
    const methodology = placement.methodology;
    const tagManagers = placement.patterns.tag_manager_placement;
    const directTags = placement.patterns.direct_placement;
    const nestedTags = placement.patterns.nested_placement;

    let analysis = '';

    // Primary methodology analysis
    switch (methodology) {
      case 'no_tag_management':
        analysis = 'No tag management systems detected.';
        if (directTags.length > 0) {
          analysis += ` Found ${directTags.length} direct tag implementation${directTags.length > 1 ? 's' : ''}: ${directTags.map(tag => tag.name).join(', ')}.`;
        } else {
          analysis += ' No tracking tags detected on this page.';
        }
        break;
      
      case 'tealium_managed':
        const tealium = tagManagers.find(tm => tm.system === 'Tealium');
        analysis = `Tags managed through Tealium (${tealium.account}/${tealium.profile}/${tealium.environment}). Implementation: ${tealium.implementation_type}, Loading: ${tealium.loading_pattern}.`;
        break;
      
      case 'gtm_managed':
        const gtm = tagManagers.find(tm => tm.system === 'Google Tag Manager');
        const containerCount = gtm.containers.length;
        analysis = `Tags managed through Google Tag Manager (${containerCount} container${containerCount > 1 ? 's' : ''}). Implementation: ${gtm.implementation_type}, Loading: ${gtm.loading_pattern}.`;
        break;
      
      case 'dual_tag_managers':
        analysis = 'Multiple tag management systems detected. This may indicate a migration in progress or conflicting implementations.';
        break;
      
      default:
        analysis = 'Tag placement methodology could not be determined.';
    }

    // Add direct tags information if present
    if (directTags.length > 0 && methodology !== 'no_tag_management') {
      analysis += ` Additionally found ${directTags.length} direct tag${directTags.length > 1 ? 's' : ''}: ${directTags.map(tag => tag.name).join(', ')}.`;
    }

    // Add nested implementation information
    if (nestedTags.length > 0) {
      analysis += ` Potential nested implementation detected - requires investigation.`;
    }

    return analysis;
  }

  /**
   * Generate placement recommendations
   */
  generatePlacementRecommendations(placement) {
    const recommendations = [];
    const methodology = placement.methodology;
    const directTags = placement.patterns.direct_placement;
    const nestedTags = placement.patterns.nested_placement;

    // Core methodology recommendations
    switch (methodology) {
      case 'no_tag_management':
        recommendations.push('Implement a tag management system for centralized control');
        recommendations.push('Consider Tealium for enterprise-grade tag management');
        break;
      
      case 'tealium_managed':
        recommendations.push('Tealium implementation detected - verify all tags are managed through Tealium');
        recommendations.push('Review for any remaining hard-coded tags in HTML');
        break;
      
      case 'gtm_managed':
        recommendations.push('GTM implementation detected - consider migration to Tealium for enhanced features');
        recommendations.push('Audit tags within GTM for optimization opportunities');
        break;
      
      case 'dual_tag_managers':
        recommendations.push('Multiple tag managers detected - review for redundancy');
        recommendations.push('Plan migration strategy to consolidate to single tag manager');
        recommendations.push('Check for duplicate tracking events');
        recommendations.push('Prioritize completing migration to avoid conflicts');
        break;
    }

    // Direct tag recommendations
    if (directTags.length > 0) {
      recommendations.push(`Found ${directTags.length} direct tag${directTags.length > 1 ? 's' : ''} - consider migrating to tag management system`);
      const directTagNames = directTags.map(tag => tag.name).join(', ');
      recommendations.push(`Direct tags detected: ${directTagNames} - evaluate for TMS migration`);
      
      // Check for async/defer loading optimization
      const syncTags = directTags.filter(tag => tag.loading_pattern === 'synchronous');
      if (syncTags.length > 0) {
        recommendations.push('Consider async loading for direct tags to improve page performance');
      }
    }

    // Nested implementation recommendations
    if (nestedTags.length > 0) {
      recommendations.push('Investigate potential nested tag manager implementations');
      recommendations.push('Verify if one tag manager is loading another to avoid conflicts');
      recommendations.push('Consider consolidating to single tag management approach');
    }

    return recommendations;
  }

  /**
   * Analyze direct tag placement (tags not managed by tag managers)
   */
  analyzeDirectTagPlacement($) {
    const directTags = [];

    if (!$) return directTags;

    // Common analytics and marketing tags that might be placed directly
    const directTagPatterns = [
      { name: 'Facebook Pixel', pattern: /connect\.facebook\.net\/.*\/fbevents\.js/ },
      { name: 'Google Analytics (legacy)', pattern: /google-analytics\.com\/ga\.js/ },
      { name: 'Adobe Analytics', pattern: /omniture|s_code|adobe|dtm/ },
      { name: 'Hotjar', pattern: /static\.hotjar\.com/ },
      { name: 'Intercom', pattern: /widget\.intercom\.io/ },
      { name: 'Salesforce Pardot', pattern: /pardot\.com/ },
      { name: 'HubSpot', pattern: /js\.hs-scripts\.com/ },
      { name: 'Segment', pattern: /cdn\.segment\.com/ },
      { name: 'Mixpanel', pattern: /mixpanel\.com/ },
      { name: 'Amplitude', pattern: /amplitude\.com/ }
    ];

    // Check external scripts
    $('script[src]').each((index, element) => {
      const src = $(element).attr('src') || '';
      
      directTagPatterns.forEach(pattern => {
        if (pattern.pattern.test(src)) {
          directTags.push({
            name: pattern.name,
            src: src,
            placement: 'external_script',
            loading_pattern: this.getScriptLoadingPattern($(element))
          });
        }
      });
    });

    // Check inline scripts for direct implementations
    $('script:not([src])').each((index, element) => {
      const content = $(element).html() || '';
      
      directTagPatterns.forEach(pattern => {
        if (pattern.pattern.test(content)) {
          directTags.push({
            name: pattern.name,
            src: 'inline_script',
            placement: 'inline_script',
            loading_pattern: 'synchronous'
          });
        }
      });
    });

    return directTags;
  }

  /**
   * Analyze nested implementations (tag managers within tag managers)
   */
  analyzeNestedImplementations(tealiumResult, gtmResult, $) {
    const nestedImplementations = [];

    if (!$) return nestedImplementations;

    // This would require more sophisticated analysis
    // For now, we'll detect if both GTM and Tealium are present which could indicate nesting
    if (tealiumResult.found && gtmResult.found) {
      nestedImplementations.push({
        type: 'potential_nesting',
        description: 'Both Tealium and GTM detected - may indicate one is loaded within the other',
        primary_system: 'unknown',
        secondary_system: 'unknown',
        recommendation: 'Investigate whether GTM is being loaded through Tealium or vice versa'
      });
    }

    return nestedImplementations;
  }

  /**
   * Get loading pattern for a specific script element
   */
  getScriptLoadingPattern($element) {
    if ($element.attr('defer') !== undefined) return 'deferred';
    if ($element.attr('async') !== undefined) return 'asynchronous';
    return 'synchronous';
  }

  /**
   * Detect potential conflicts between GTM and Tealium (legacy)
   */
  detectTagConflicts(tealiumResult, gtmResult) {
    const conflicts = [];

    // Check for common analytics overlaps
    const commonAnalytics = [
      'Google Analytics',
      'Facebook Pixel',
      'Google Ads',
      'LinkedIn Ads',
      'Twitter Ads'
    ];

    // This is a simplified conflict detection
    // In a real implementation, we'd analyze the actual tag configurations
    if (tealiumResult.found && gtmResult.found) {
      conflicts.push({
        type: 'dual_implementation',
        severity: 'high',
        description: 'Both GTM and Tealium are active - potential for duplicate tracking',
        recommendation: 'Audit all tags to prevent duplicate events'
      });

      // Check for GA4 presence in both
      const hasGA4InGTM = gtmResult.containers.some(c => c.startsWith('G-'));
      const mightHaveGA4InTealium = tealiumResult.details.tealium_version; // Assumption

      if (hasGA4InGTM && mightHaveGA4InTealium) {
        conflicts.push({
          type: 'analytics_duplication',
          severity: 'critical',
          description: 'Potential duplicate Google Analytics tracking via both systems',
          recommendation: 'Ensure GA4 is only active in one system'
        });
      }
    }

    return conflicts;
  }

  /**
   * Analyze a website to recommend crawl parameters
   */
  async analyzeSite(baseUrl) {
    console.log(`🔍 Analyzing site structure: ${baseUrl}`);
    
    const analysis = {
      baseUrl,
      timestamp: new Date().toISOString(),
      sitemap: { found: false, urls: [], estimated_pages: 0 },
      structure: { estimated_depth: 1, navigation_complexity: 'simple' },
      recommendations: {
        max_pages: 10,
        max_depth: 2,
        strategy: 'standard',
        reasoning: []
      },
      issues: [],
      fallback_used: false
    };

    try {
      const normalizedUrl = this.normalizeUrl(baseUrl);
      
      // Step 1: Check for sitemap
      console.log(`📋 Step 1: Checking for sitemaps...`);
      const sitemapInfo = await this.checkSitemap(normalizedUrl);
      analysis.sitemap = sitemapInfo;
      
      if (!sitemapInfo.found) {
        analysis.issues.push('No sitemap.xml found - will estimate from homepage structure');
      } else {
        console.log(`✅ Sitemap found with ${sitemapInfo.estimated_pages} pages`);
      }
      
      // Step 2: Analyze homepage structure
      console.log(`🏠 Step 2: Analyzing homepage structure...`);
      const structureInfo = await this.analyzePageStructure(normalizedUrl);
      analysis.structure = structureInfo;
      
      // Step 3: Check if we need Crawlee fallback for bot-protected sites
      if (analysis.structure.total_links === 0 && analysis.sitemap.estimated_pages === 0) {
        console.log(`🤖 Step 3: Attempting Crawlee fallback for bot-protected site...`);
        const fallbackResult = await this.tryStructureAnalysisFallback(normalizedUrl);
        if (fallbackResult.success) {
          analysis.structure = { ...analysis.structure, ...fallbackResult.structure };
          analysis.fallback_used = true;
          console.log(`✅ Crawlee fallback successful - found ${fallbackResult.structure.total_links} links`);
        } else {
          analysis.issues.push(`Bot protection detected - ${fallbackResult.error}`);
          console.log(`⚠️ Crawlee fallback failed: ${fallbackResult.error}`);
        }
      }
      
      // Step 4: Generate recommendations
      analysis.recommendations = this.generateCrawlRecommendations(analysis.sitemap, analysis.structure);
      
      console.log(`✅ Site analysis complete:`);
      console.log(`   📊 Estimated pages: ${analysis.sitemap.estimated_pages || analysis.structure.estimated_pages || 'unknown'}`);
      console.log(`   📊 Estimated depth: ${analysis.structure.estimated_depth}`);
      console.log(`   💡 Recommended: ${analysis.recommendations.max_pages} pages, depth ${analysis.recommendations.max_depth}`);
      console.log(`   🔧 Strategy: ${analysis.recommendations.strategy}`);
      
      if (analysis.issues.length > 0) {
        console.log(`   ⚠️ Issues detected: ${analysis.issues.length}`);
        analysis.issues.forEach(issue => console.log(`      • ${issue}`));
      }
      
    } catch (error) {
      console.error(`❌ Site analysis error:`, error.message);
      analysis.error = error.message;
      analysis.issues.push(`Analysis failed: ${error.message}`);
      
      // Provide detailed error information
      if (error.response?.status === 403) {
        analysis.issues.push('Site appears to have bot protection - consider using browser-based crawling');
      } else if (error.code === 'ENOTFOUND') {
        analysis.issues.push('Domain not found - please check the URL is correct');
      } else if (error.code === 'ECONNREFUSED') {
        analysis.issues.push('Connection refused - site may be down or blocking requests');
      } else if (error.code === 'ETIMEDOUT') {
        analysis.issues.push('Request timed out - site may be slow or blocking requests');
      }
      
      // Fallback to conservative defaults
      analysis.recommendations = {
        max_pages: 5,
        max_depth: 1,
        strategy: 'conservative',
        reasoning: ['Analysis failed - using conservative defaults for safety']
      };
    }

    return analysis;
  }

  /**
   * Try structure analysis using direct Playwright for bot-protected sites
   */
  async tryStructureAnalysisFallback(baseUrl) {
    const result = {
      success: false,
      structure: {
        estimated_depth: 1,
        navigation_complexity: 'simple',
        total_links: 0,
        internal_links: 0,
        estimated_pages: 0
      },
      error: null
    };

    try {
      // Import PlaywrightDirect dynamically to avoid dependency issues
      const { PlaywrightDirect } = await import('./playwright-direct.js');
      const playwrightDirect = new PlaywrightDirect({ timeout: 30000 });
      
      // Use direct Playwright to load the page and extract structure
      console.log(`🎭 Using direct Playwright to analyze site structure...`);
      const pageData = await playwrightDirect.extractPageStructure(baseUrl);
      
      if (pageData.success) {
        result.success = true;
        result.structure = {
          estimated_depth: pageData.estimated_depth || 2,
          navigation_complexity: pageData.navigation_complexity || 'moderate',
          total_links: pageData.total_links || 0,
          internal_links: pageData.internal_links || 0,
          estimated_pages: Math.max(pageData.internal_links || 0, 10)
        };
        
        console.log(`✅ Direct Playwright structure analysis successful: ${result.structure.internal_links} internal links found`);
      } else {
        result.error = pageData.error || 'Unknown error during Playwright analysis';
        console.log(`❌ Direct Playwright analysis failed: ${result.error}`);
      }
      
    } catch (error) {
      result.error = `Direct Playwright fallback failed: ${error.message}`;
      console.log(`❌ Playwright structure analysis failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Check for sitemap.xml and analyze it
   */
  async checkSitemap(baseUrl) {
    const sitemapInfo = {
      found: false,
      urls: [],
      estimated_pages: 0,
      last_modified: null
    };

    const sitemapUrls = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/sitemap/sitemap.xml`,
      `${baseUrl}/sitemaps/sitemap.xml`
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        console.log(`🔍 Checking sitemap: ${sitemapUrl}`);
        
        const response = await axios.get(sitemapUrl, {
          timeout: 10000,
          headers: { 'User-Agent': this.userAgent },
          validateStatus: (status) => status === 200
        });

        if (response.data.includes('<sitemap') || response.data.includes('<url>')) {
          console.log(`✅ Found sitemap: ${sitemapUrl}`);
          sitemapInfo.found = true;
          
          // Parse XML to count URLs
          const urlMatches = response.data.match(/<url>/g);
          const sitemapMatches = response.data.match(/<sitemap>/g);
          
          if (urlMatches) {
            sitemapInfo.estimated_pages = urlMatches.length;
            sitemapInfo.urls = this.extractSitemapUrls(response.data).slice(0, 100); // Sample
          } else if (sitemapMatches) {
            // Sitemap index - estimate based on number of sitemaps
            sitemapInfo.estimated_pages = Math.max(sitemapMatches.length * 50, 100);
          }
          
          break;
        }
      } catch (error) {
        console.log(`   ⚠️ Sitemap not found: ${sitemapUrl}`);
        // Continue to next sitemap URL
      }
    }

    if (!sitemapInfo.found) {
      console.log(`📋 No sitemap found - will estimate from site structure`);
    }

    return sitemapInfo;
  }

  /**
   * Extract URLs from sitemap XML
   */
  extractSitemapUrls(xmlContent) {
    const urls = [];
    const urlRegex = /<loc>(.*?)<\/loc>/g;
    let match;
    
    while ((match = urlRegex.exec(xmlContent)) !== null) {
      urls.push(match[1]);
    }
    
    return urls;
  }

  /**
   * Analyze homepage structure to estimate site complexity
   */
  async analyzePageStructure(baseUrl) {
    const structure = {
      estimated_depth: 1,
      navigation_complexity: 'simple',
      total_links: 0,
      internal_links: 0,
      navigation_patterns: [],
      page_types: []
    };

    try {
      const response = await axios.get(baseUrl, {
        timeout: 15000,
        headers: { 'User-Agent': this.userAgent }
      });

      const $ = load(response.data);
      const baseDomain = new URL(baseUrl).hostname;
      
      // Analyze navigation structure
      const navElements = $('nav, .nav, .navigation, .menu, header').length;
      const menuItems = $('nav a, .nav a, .menu a, header a').length;
      
      // Count all links
      const allLinks = $('a[href]');
      structure.total_links = allLinks.length;
      
      // Analyze internal links and their depth patterns
      const internalLinks = [];
      const pathDepths = [];
      
      allLinks.each((_, element) => {
        const href = $(element).attr('href');
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
            internalLinks.push(fullUrl);
            const pathSegments = urlObj.pathname.split('/').filter(Boolean);
            pathDepths.push(pathSegments.length);
            
            // Identify page types
            if (pathSegments.length > 0) {
              structure.page_types.push(pathSegments[0]);
            }
          }
        } catch (urlError) {
          // Skip invalid URLs
        }
      });

      structure.internal_links = internalLinks.length;
      
      // Calculate estimated depth
      if (pathDepths.length > 0) {
        const maxDepth = Math.max(...pathDepths);
        const avgDepth = pathDepths.reduce((a, b) => a + b, 0) / pathDepths.length;
        structure.estimated_depth = Math.min(Math.max(Math.ceil(avgDepth), 2), 4);
      }

      // Determine complexity
      if (menuItems > 20 || structure.internal_links > 50) {
        structure.navigation_complexity = 'complex';
      } else if (menuItems > 10 || structure.internal_links > 20) {
        structure.navigation_complexity = 'moderate';
      }

      console.log(`   📊 Found ${structure.internal_links} internal links`);
      console.log(`   📊 Estimated depth: ${structure.estimated_depth}`);
      console.log(`   📊 Navigation complexity: ${structure.navigation_complexity}`);

    } catch (error) {
      console.log(`   ⚠️ Structure analysis failed: ${error.message}`);
    }

    return structure;
  }

  /**
   * Generate enhanced browser-like headers
   */
  getEnhancedHeaders(url) {
    const baseHeaders = {
      'User-Agent': this.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    };

    if (!this.useEnhancedBrowserMimicking) {
      return {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      };
    }

    // Add referer for non-root pages
    try {
      const urlObj = new URL(url);
      if (urlObj.pathname !== '/' && urlObj.pathname !== '') {
        baseHeaders['Referer'] = `${urlObj.protocol}//${urlObj.host}/`;
      }
      
      // Add host header
      baseHeaders['Host'] = urlObj.host;
      
      // Add additional browser-specific headers for known CDNs/platforms
      if (url.includes('dealeron.com') || url.includes('wordpress.com') || url.includes('wp-engine.com')) {
        // Some platforms are very sensitive to bot detection
        baseHeaders['DNT'] = '1';
        baseHeaders['Sec-GPC'] = '1';
        // Remove some headers that might flag as bot
        delete baseHeaders['Sec-Fetch-Dest'];
        delete baseHeaders['Sec-Fetch-Mode'];
        delete baseHeaders['Sec-Fetch-Site'];
        delete baseHeaders['Sec-Fetch-User'];
      }
      
    } catch (error) {
      // Invalid URL - use base headers
    }

    return baseHeaders;
  }

  /**
   * Enhanced fetch with retry logic for challenging sites
   */
  async fetchWithRetry(url, maxRetries = 2) {
    let lastError;
    
    console.log(`🌐 Starting fetch process for: ${url}`);
    console.log(`⚙️ Max retries configured: ${maxRetries}`);
    console.log(`⏱️ Timeout configured: ${this.timeout}ms`);
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        console.log(`🔄 Fetch attempt ${attempt}/${maxRetries + 1}: ${url}`);
        console.log(`🔧 Preparing HTTP request headers...`);
        
        // Use different strategies for each attempt
        const headers = this.getEnhancedHeaders(url);
        console.log(`📋 Request headers prepared: ${Object.keys(headers).length} headers`);
        console.log(`🤖 User-Agent: ${headers['User-Agent']?.substring(0, 50)}...`);
        
        if (attempt === 2) {
          // Second attempt: Use even more realistic browser headers
          headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
          headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
          headers['Pragma'] = 'no-cache';
        } else if (attempt === 3) {
          // Third attempt: Mobile user agent
          headers['User-Agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
          headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
        }
        
        console.log(`🚀 Initiating HTTP GET request to: ${url}`);
        console.log(`⏱️ Request timeout set to: ${this.timeout}ms`);
        console.log(`🔗 Max redirects allowed: 5`);
        
        const startTime = Date.now();
        const response = await axios.get(url, {
          timeout: this.timeout,
          headers,
          validateStatus: (status) => status >= 200 && status < 400,
          maxRedirects: 5,
          decompress: true,
          withCredentials: false
        });
        const endTime = Date.now();
        
        console.log(`✅ HTTP ${response.status}: ${url} (attempt ${attempt})`);
        console.log(`⏱️ Response received in ${endTime - startTime}ms`);
        console.log(`📦 Content-Type: ${response.headers['content-type']}`);
        console.log(`📏 Content-Length: ${response.headers['content-length'] || response.data?.length || 'unknown'} bytes`);
        console.log(`🔗 Final URL after redirects: ${response.request?.responseURL || url}`);
        return response;
        
      } catch (error) {
        lastError = error;
        const endTime = Date.now();
        console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
        console.log(`🔍 Error details:`);
        console.log(`   • Error code: ${error.code || 'N/A'}`);
        console.log(`   • Error type: ${error.name || 'N/A'}`);
        console.log(`   • HTTP status: ${error.response?.status || 'N/A'}`);
        console.log(`   • Status text: ${error.response?.statusText || 'N/A'}`);
        console.log(`   • Request URL: ${error.config?.url || url}`);
        console.log(`   • Request method: ${error.config?.method?.toUpperCase() || 'GET'}`);
        console.log(`   • Timeout configured: ${error.config?.timeout || 'N/A'}ms`);
        console.log(`   • User-Agent used: ${error.config?.headers?.['User-Agent']?.substring(0, 50)}...`);
        
        if (error.response?.headers) {
          console.log(`   • Server headers: ${Object.keys(error.response.headers).join(', ')}`);
        }
        
        if (attempt <= maxRetries) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏱️ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Generate intelligent crawl recommendations
   */
  generateCrawlRecommendations(sitemapInfo, structureInfo) {
    const recommendations = {
      max_pages: 10,
      max_depth: 2,
      strategy: 'standard',
      reasoning: []
    };

    // Get total estimated pages from either sitemap or structure analysis
    const totalEstimatedPages = sitemapInfo.estimated_pages || structureInfo.estimated_pages || 0;
    const internalLinks = structureInfo.internal_links || 0;

    // Base recommendations on sitemap if available
    if (sitemapInfo.found && sitemapInfo.estimated_pages > 0) {
      if (sitemapInfo.estimated_pages <= 10) {
        recommendations.max_pages = Math.min(sitemapInfo.estimated_pages, 10);
        recommendations.strategy = 'small_site';
        recommendations.reasoning.push(`Small site detected (${sitemapInfo.estimated_pages} pages from sitemap)`);
      } else if (sitemapInfo.estimated_pages <= 50) {
        recommendations.max_pages = 20;
        recommendations.strategy = 'medium_site';
        recommendations.reasoning.push(`Medium site detected (~${sitemapInfo.estimated_pages} pages from sitemap)`);
      } else {
        recommendations.max_pages = 30;
        recommendations.strategy = 'large_site';
        recommendations.reasoning.push(`Large site detected (${sitemapInfo.estimated_pages}+ pages from sitemap)`);
      }
    } else if (internalLinks > 0) {
      // Use structure analysis when no sitemap is available
      if (internalLinks <= 15) {
        recommendations.max_pages = Math.max(internalLinks, 5);
        recommendations.strategy = 'small_site';
        recommendations.reasoning.push(`Small site estimated (${internalLinks} internal links found)`);
      } else if (internalLinks <= 50) {
        recommendations.max_pages = Math.min(internalLinks + 5, 25);
        recommendations.strategy = 'medium_site';
        recommendations.reasoning.push(`Medium site estimated (~${internalLinks} internal links found)`);
      } else {
        recommendations.max_pages = 30;
        recommendations.strategy = 'large_site';
        recommendations.reasoning.push(`Large site estimated (${internalLinks}+ internal links found)`);
      }
    } else {
      // Fallback for when no reliable data is available
      recommendations.max_pages = 10;
      recommendations.strategy = 'conservative';
      recommendations.reasoning.push('Unable to determine site size - using conservative limits');
    }

    // Adjust based on structure complexity
    if (structureInfo.navigation_complexity === 'complex') {
      recommendations.max_pages = Math.max(recommendations.max_pages, 25);
      recommendations.max_depth = Math.max(recommendations.max_depth, 3);
      recommendations.reasoning.push('Complex navigation detected - increased limits');
    } else if (structureInfo.navigation_complexity === 'simple' && !sitemapInfo.found) {
      recommendations.max_depth = Math.min(recommendations.max_depth, 2);
      recommendations.reasoning.push('Simple navigation - focused crawl sufficient');
    }

    // Adjust based on estimated depth
    if (structureInfo.estimated_depth > 2) {
      recommendations.max_depth = Math.min(structureInfo.estimated_depth, 4);
      recommendations.reasoning.push(`Deep site structure detected (${structureInfo.estimated_depth} levels)`);
    }

    // Add specific recommendations for bot-protected sites
    if (structureInfo.fallback_used || structureInfo.bot_protection_detected) {
      recommendations.strategy = 'browser_based';
      recommendations.reasoning.push('Bot protection detected - browser-based crawling recommended');
    }

    // Safety limits
    recommendations.max_pages = Math.min(recommendations.max_pages, 50);
    recommendations.max_depth = Math.min(recommendations.max_depth, 4);

    // Ensure minimum reasonable values
    recommendations.max_pages = Math.max(recommendations.max_pages, 5);
    recommendations.max_depth = Math.max(recommendations.max_depth, 1);

    return recommendations;
  }

  /**
   * Crawl a website to discover pages and analyze tag coverage
   */
  async crawlSite(baseUrl, options = {}) {
    const {
      maxPages = 10,
      maxDepth = 2,
      targetAccount,
      targetProfile = null,
      environment = 'prod',
      targetGtmContainer = null,
      includePaths = [],
      excludePaths = ['/admin', '/wp-admin', '/private']
    } = options;

    console.log(`🕷️ Starting site crawl for: ${baseUrl}`);
    console.log(`   📊 Max pages: ${maxPages}, Max depth: ${maxDepth}`);

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
      relationship_analysis: {
        consistent_implementation: true,
        inconsistencies: [],
        migration_progress: 0
      }
    };

    const visitedUrls = new Set();
    const urlsToVisit = [{ url: this.normalizeUrl(baseUrl), depth: 0 }];
    
    try {
      while (urlsToVisit.length > 0 && crawlResult.pages.length < maxPages) {
        const { url, depth } = urlsToVisit.shift();
        
        if (visitedUrls.has(url) || depth > maxDepth) {
          continue;
        }

        console.log(`🔍 Crawling page ${crawlResult.pages.length + 1}/${maxPages}: ${url} (depth: ${depth})`);
        visitedUrls.add(url);

        // Scan this page
        const pageResult = await this.scanUrl(url, targetAccount, targetProfile, environment, targetGtmContainer);
        pageResult.depth = depth;
        crawlResult.pages.push(pageResult);

        // If we haven't reached max depth, discover more URLs from this page
        if (depth < maxDepth && pageResult.success) {
          try {
            const newUrls = await this.discoverUrls(url, baseUrl, excludePaths);
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
      crawlResult.summary = this.analyzeCrawlResults(crawlResult.pages);
      crawlResult.relationship_analysis = this.analyzeMultiPageRelationships(crawlResult.pages);

      console.log(`✅ Crawl completed: ${crawlResult.pages.length} pages analyzed`);
      console.log(`   📊 Coverage: ${crawlResult.summary.coverage_percentage}%`);

    } catch (error) {
      console.error(`❌ Crawl error:`, error.message);
      crawlResult.error = error.message;
    }

    return crawlResult;
  }

  /**
   * Discover URLs from a page's HTML
   */
  async discoverUrls(pageUrl, baseUrl, excludePaths = []) {
    try {
      const response = await axios.get(pageUrl, {
        timeout: this.timeout,
        headers: { 'User-Agent': this.userAgent }
      });

      const $ = load(response.data);
      const discoveredUrls = new Set();
      const baseDomain = new URL(baseUrl).hostname;

      // Find all links
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (!href) return;

        try {
          let fullUrl;
          if (href.startsWith('http')) {
            fullUrl = href;
          } else if (href.startsWith('/')) {
            fullUrl = new URL(href, baseUrl).href;
          } else {
            fullUrl = new URL(href, pageUrl).href;
          }

          const urlObj = new URL(fullUrl);
          
          // Only include URLs from the same domain
          if (urlObj.hostname === baseDomain) {
            // Check if path should be excluded
            const shouldExclude = excludePaths.some(excludePath => 
              urlObj.pathname.startsWith(excludePath)
            );
            
            if (!shouldExclude && !fullUrl.includes('#') && !fullUrl.includes('?')) {
              discoveredUrls.add(fullUrl);
            }
          }
        } catch (urlError) {
          // Skip invalid URLs
        }
      });

      return Array.from(discoveredUrls).slice(0, 20); // Limit URLs per page
    } catch (error) {
      console.log(`   ⚠️ Failed to discover URLs from ${pageUrl}: ${error.message}`);
      return [];
    }
  }

  /**
   * Analyze crawl results for coverage and consistency
   */
  analyzeCrawlResults(pages) {
    const summary = {
      total_pages: pages.length,
      pages_with_tealium: 0,
      pages_with_gtm: 0,
      pages_with_both: 0,
      pages_with_neither: 0,
      successful_scans: 0,
      failed_scans: 0,
      coverage_percentage: 0,
      // Enhanced coverage metrics
      tealium_coverage: {
        pages_with_tealium: 0,
        pages_without_tealium: 0,
        coverage_percentage: 0,
        missing_pages: []
      },
      gtm_coverage: {
        pages_with_gtm: 0,
        pages_without_gtm: 0,
        coverage_percentage: 0,
        missing_pages: []
      }
    };

    pages.forEach(page => {
      if (!page.success) {
        summary.failed_scans++;
        return;
      }

      summary.successful_scans++;
      const hasTealium = page.found;
      const hasGtm = page.gtm && page.gtm.found;

      // Overall categorization
      if (hasTealium && hasGtm) {
        summary.pages_with_both++;
      } else if (hasTealium) {
        summary.pages_with_tealium++;
      } else if (hasGtm) {
        summary.pages_with_gtm++;
      } else {
        summary.pages_with_neither++;
      }

      // Tealium-specific tracking
      if (hasTealium) {
        summary.tealium_coverage.pages_with_tealium++;
      } else {
        summary.tealium_coverage.pages_without_tealium++;
        summary.tealium_coverage.missing_pages.push({
          url: page.url,
          priority: this.assessPagePriority(page.url),
          depth: page.depth || 0
        });
      }

      // GTM-specific tracking
      if (hasGtm) {
        summary.gtm_coverage.pages_with_gtm++;
      } else {
        summary.gtm_coverage.pages_without_gtm++;
        summary.gtm_coverage.missing_pages.push({
          url: page.url,
          priority: this.assessPagePriority(page.url),
          depth: page.depth || 0
        });
      }
    });

    // Calculate overall coverage percentage
    const pagesWithTags = summary.pages_with_tealium + summary.pages_with_gtm + summary.pages_with_both;
    summary.coverage_percentage = summary.successful_scans > 0 
      ? Math.round((pagesWithTags / summary.successful_scans) * 100)
      : 0;

    // Calculate Tealium coverage percentage
    summary.tealium_coverage.coverage_percentage = summary.successful_scans > 0
      ? Math.round((summary.tealium_coverage.pages_with_tealium / summary.successful_scans) * 100)
      : 0;

    // Calculate GTM coverage percentage
    summary.gtm_coverage.coverage_percentage = summary.successful_scans > 0
      ? Math.round((summary.gtm_coverage.pages_with_gtm / summary.successful_scans) * 100)
      : 0;

    // Sort missing pages by priority
    summary.tealium_coverage.missing_pages.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority; // High priority first
      return a.depth - b.depth; // Shallow pages first for same priority
    });

    summary.gtm_coverage.missing_pages.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.depth - b.depth;
    });

    return summary;
  }

  /**
   * Assess page priority for coverage analysis
   */
  assessPagePriority(url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.toLowerCase();
      
      // Define priority levels: 3 = high, 2 = medium, 1 = low
      const highPriorityPatterns = [
        '/', '/home', '/index',  // Homepage
        '/contact', '/about', '/services', '/products',  // Key pages
        '/checkout', '/cart', '/purchase', '/buy',  // E-commerce
        '/signup', '/register', '/login',  // User actions
        '/pricing', '/plans'  // Sales pages
      ];
      
      const mediumPriorityPatterns = [
        '/blog', '/news', '/articles',  // Content pages
        '/support', '/help', '/faq',  // Support pages
        '/categories', '/category'  // Category pages
      ];

      // Check for high priority
      if (highPriorityPatterns.some(pattern => 
        path === pattern || path.startsWith(pattern + '/')
      )) {
        return 3;
      }

      // Check for medium priority
      if (mediumPriorityPatterns.some(pattern => 
        path === pattern || path.startsWith(pattern + '/')
      )) {
        return 2;
      }

      // Low priority (default)
      return 1;
    } catch (error) {
      return 1; // Default to low priority on error
    }
  }

  /**
   * Analyze relationships across multiple pages
   */
  analyzeMultiPageRelationships(pages) {
    const analysis = {
      consistent_implementation: true,
      inconsistencies: [],
      migration_progress: 0,
      patterns: {
        tealium_only_pages: [],
        gtm_only_pages: [],
        both_tags_pages: [],
        no_tags_pages: []
      }
    };

    const successfulPages = pages.filter(p => p.success);
    
    if (successfulPages.length === 0) {
      return analysis;
    }

    // Categorize pages by their tag implementation
    successfulPages.forEach(page => {
      const hasTealium = page.found;
      const hasGtm = page.gtm && page.gtm.found;

      if (hasTealium && hasGtm) {
        analysis.patterns.both_tags_pages.push(page.url);
      } else if (hasTealium) {
        analysis.patterns.tealium_only_pages.push(page.url);
      } else if (hasGtm) {
        analysis.patterns.gtm_only_pages.push(page.url);
      } else {
        analysis.patterns.no_tags_pages.push(page.url);
      }
    });

    // Check for consistency
    const hasMultiplePatterns = [
      analysis.patterns.tealium_only_pages.length,
      analysis.patterns.gtm_only_pages.length,
      analysis.patterns.both_tags_pages.length
    ].filter(count => count > 0).length > 1;

    if (hasMultiplePatterns) {
      analysis.consistent_implementation = false;
      analysis.inconsistencies.push('Mixed tag management implementations across pages');
    }

    // Calculate migration progress (if both GTM and Tealium are present on the site)
    const totalTaggedPages = successfulPages.length - analysis.patterns.no_tags_pages.length;
    if (totalTaggedPages > 0) {
      const tealiumPages = analysis.patterns.tealium_only_pages.length + analysis.patterns.both_tags_pages.length;
      analysis.migration_progress = Math.round((tealiumPages / totalTaggedPages) * 100);
    }

    return analysis;
  }
}

export default CheerioDetector;