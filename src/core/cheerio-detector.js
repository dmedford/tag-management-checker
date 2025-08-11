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

      // Relationship Analysis
      result.relationship = this.analyzeTagRelationship(result, gtmResults);

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

    // Extract version information from URL parameters
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
    
    const gtmScripts = scripts.filter(src => 
      src.includes('googletagmanager.com/gtag/js') ||
      src.includes('googletagmanager.com/gtm.js') ||
      src.includes('googletagmanager.com/ns.html')
    );

    console.log(`🎯 Found ${gtmScripts.length} GTM-related external scripts:`, gtmScripts);

    // Method 2: Look for inline GTM scripts
    const inlineScripts = $('script:not([src])').toArray();
    const inlineScriptTexts = inlineScripts.map(script => $(script).html() || '');
    
    console.log(`📄 Found ${inlineScripts.length} inline script tags`);
    console.log(`🔍 Analyzing inline scripts for GTM patterns...`);
    
    const containerIds = new Set();
    
    // Extract container IDs from external scripts
    gtmScripts.forEach(src => {
      const gtmMatch = src.match(/[?&]id=(GTM-[A-Z0-9]{6,})/); // GTM IDs are typically 6+ chars
      const gtagMatch = src.match(/[?&]id=(G-[A-Z0-9]{10})/); // GA4 IDs are typically 10 chars
      
      if (gtmMatch) {
        containerIds.add(gtmMatch[1]);
        console.log(`Found GTM container from script: ${gtmMatch[1]}`);
      }
      if (gtagMatch) {
        containerIds.add(gtagMatch[1]);
        console.log(`Found GA4 container from script: ${gtagMatch[1]}`);
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
      const gtmMatches = scriptText.match(/['"`]GTM-[A-Z0-9]{6,}['"`]/g);
      if (gtmMatches) {
        console.log(`   ✅ Method 1 - Found quoted GTM IDs:`, gtmMatches);
        gtmMatches.forEach(match => {
          const containerId = match.replace(/['"`]/g, '');
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
          const gtmMatches = afterDataLayer.match(/GTM-[A-Z0-9]{6,}/g);
          if (gtmMatches) {
            console.log(`   ✅ Method 2 - Found GTM IDs in IIFE pattern:`, gtmMatches);
            gtmMatches.forEach(containerId => {
              containerIds.add(containerId);
              console.log(`   ➕ Added GTM container from IIFE pattern: ${containerId}`);
            });
          }
        }
      }

      // Method 3: Look for GTM function parameter patterns like ...,'GTM-XXXXX');
      const functionParamMatches = scriptText.match(/,\s*['"]GTM-[A-Z0-9]{6,}['"],?\s*\)/g);
      if (functionParamMatches) {
        functionParamMatches.forEach(match => {
          const gtmMatch = match.match(/['"]GTM-[A-Z0-9]{6,}['"]/);
          if (gtmMatch) {
            const containerId = gtmMatch[0].replace(/['"`]/g, '');
            containerIds.add(containerId);
            console.log(`Found GTM container from function parameter: ${containerId}`);
          }
        });
      }

      // Method 4: Look for GTM URL construction patterns 'gtm.js?id='+i where i is GTM ID
      if (scriptText.includes('gtm.js?id=') || scriptText.includes('googletagmanager.com')) {
        // Look for variable assignments that might contain GTM IDs
        const variableMatches = scriptText.match(/[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*['"]GTM-[A-Z0-9]{6,}['"]/g);
        if (variableMatches) {
          variableMatches.forEach(match => {
            const gtmMatch = match.match(/['"]GTM-[A-Z0-9]{6,}['"]/);
            if (gtmMatch) {
              const containerId = gtmMatch[0].replace(/['"`]/g, '');
              containerIds.add(containerId);
              console.log(`Found GTM container from variable assignment: ${containerId}`);
            }
          });
        }
      }

      // Method 5: Look for GA4 measurement IDs (G-XXXXXXXXXX)
      const ga4Matches = scriptText.match(/['"`]G-[A-Z0-9]{10}['"`]/g);
      if (ga4Matches) {
        ga4Matches.forEach(match => {
          const measurementId = match.replace(/['"`]/g, '');
          containerIds.add(measurementId);
          console.log(`Found GA4 measurement ID from inline script: ${measurementId}`);
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

      // Method 7: Fallback - any GTM or GA4 ID in the script (very permissive)
      // This should catch anything we missed with the more specific patterns
      const fallbackGtmMatches = scriptText.match(/GTM-[A-Z0-9]{6,}/gi); // Case insensitive
      if (fallbackGtmMatches) {
        fallbackGtmMatches.forEach(containerId => {
          const normalizedId = containerId.toUpperCase();
          if (!containerIds.has(normalizedId)) {
            containerIds.add(normalizedId);
            console.log(`Found GTM container (fallback method): ${normalizedId}`);
          }
        });
      }

      const fallbackGa4Matches = scriptText.match(/G-[A-Z0-9]{10}/gi); // Case insensitive
      if (fallbackGa4Matches) {
        fallbackGa4Matches.forEach(measurementId => {
          const normalizedId = measurementId.toUpperCase();
          if (!containerIds.has(normalizedId)) {
            containerIds.add(normalizedId);
            console.log(`Found GA4 measurement ID (fallback method): ${normalizedId}`);
          }
        });
      }
    });

    // Method 3: Look for GTM noscript tags
    const noscriptElements = $('noscript').toArray();
    noscriptElements.forEach(noscript => {
      const content = $(noscript).html() || '';
      const gtmMatches = content.match(/GTM-[A-Z0-9]{6,}/g);
      if (gtmMatches) {
        gtmMatches.forEach(containerId => {
          containerIds.add(containerId);
          console.log(`Found GTM container from noscript: ${containerId}`);
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
      other: []
    };

    containers.forEach(container => {
      if (container.startsWith('GTM-')) {
        types.gtm.push(container);
      } else if (container.startsWith('G-')) {
        types.ga4.push(container);
      } else {
        types.other.push(container);
      }
    });

    return types;
  }

  /**
   * Analyze relationship between GTM and Tealium implementations
   */
  analyzeTagRelationship(tealiumResult, gtmResult) {
    const relationship = {
      status: 'none', // none, partial, complete, redundant, conflicting
      analysis: '',
      recommendations: [],
      coverage: {
        gtm_only_pages: 0,
        tealium_only_pages: 0,
        both_tags_pages: 0,
        no_tags_pages: 0
      },
      migration_status: 'unknown', // unknown, not_started, in_progress, complete, rollback
      details: {}
    };

    const hasTealium = tealiumResult.found;
    const hasGtm = gtmResult.found;

    console.log('🔄 Analyzing GTM ↔ Tealium relationship...');
    console.log(`   📊 Tealium found: ${hasTealium}`);
    console.log(`   📊 GTM found: ${hasGtm}`);

    if (!hasTealium && !hasGtm) {
      relationship.status = 'none';
      relationship.analysis = 'No tag management solution detected';
      relationship.recommendations.push('Consider implementing a tag management solution');
    } else if (hasTealium && !hasGtm) {
      relationship.status = 'tealium_only';
      relationship.analysis = 'Only Tealium implementation detected';
      relationship.migration_status = 'complete';
      relationship.recommendations.push('Tealium implementation is clean - no GTM conflicts');
    } else if (!hasTealium && hasGtm) {
      relationship.status = 'gtm_only';
      relationship.analysis = 'Only GTM implementation detected';
      relationship.migration_status = 'not_started';
      relationship.recommendations.push('Consider migrating from GTM to Tealium for unified tag management');
      relationship.recommendations.push('Plan GTM → Tealium migration strategy');
    } else if (hasTealium && hasGtm) {
      relationship.status = 'both_present';
      relationship.analysis = 'Both GTM and Tealium detected - potential dual implementation';
      relationship.migration_status = 'in_progress';
      
      // Analyze potential conflicts
      const conflicts = this.detectTagConflicts(tealiumResult, gtmResult);
      relationship.details.conflicts = conflicts;
      
      if (conflicts.length > 0) {
        relationship.status = 'conflicting';
        relationship.analysis = 'Conflicting implementations detected - may cause tracking issues';
        relationship.recommendations.push('Review for duplicate tracking events');
        relationship.recommendations.push('Plan migration timeline to remove GTM');
        relationship.recommendations.push('Test for duplicate analytics events');
      } else {
        relationship.status = 'complementary';
        relationship.analysis = 'Complementary implementations - appears to be managed migration';
        relationship.recommendations.push('Monitor for complete migration to Tealium');
        relationship.recommendations.push('Plan GTM removal once migration is verified');
      }
    }

    console.log(`   🏷️ Relationship status: ${relationship.status}`);
    console.log(`   📈 Migration status: ${relationship.migration_status}`);
    console.log(`   💡 Recommendations: ${relationship.recommendations.length}`);

    return relationship;
  }

  /**
   * Detect potential conflicts between GTM and Tealium
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
      }
    };

    try {
      const normalizedUrl = this.normalizeUrl(baseUrl);
      
      // Step 1: Check for sitemap
      const sitemapInfo = await this.checkSitemap(normalizedUrl);
      analysis.sitemap = sitemapInfo;
      
      // Step 2: Analyze homepage structure
      const structureInfo = await this.analyzePageStructure(normalizedUrl);
      analysis.structure = structureInfo;
      
      // Step 3: Generate recommendations
      analysis.recommendations = this.generateCrawlRecommendations(sitemapInfo, structureInfo);
      
      console.log(`✅ Site analysis complete:`);
      console.log(`   📊 Estimated pages: ${analysis.sitemap.estimated_pages}`);
      console.log(`   📊 Estimated depth: ${analysis.structure.estimated_depth}`);
      console.log(`   💡 Recommended: ${analysis.recommendations.max_pages} pages, depth ${analysis.recommendations.max_depth}`);
      
    } catch (error) {
      console.error(`❌ Site analysis error:`, error.message);
      analysis.error = error.message;
      
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

    // Base recommendations on sitemap if available
    if (sitemapInfo.found && sitemapInfo.estimated_pages > 0) {
      if (sitemapInfo.estimated_pages <= 10) {
        recommendations.max_pages = Math.min(sitemapInfo.estimated_pages, 10);
        recommendations.strategy = 'small_site';
        recommendations.reasoning.push(`Small site detected (${sitemapInfo.estimated_pages} pages)`);
      } else if (sitemapInfo.estimated_pages <= 50) {
        recommendations.max_pages = 20;
        recommendations.strategy = 'medium_site';
        recommendations.reasoning.push(`Medium site detected (~${sitemapInfo.estimated_pages} pages)`);
      } else {
        recommendations.max_pages = 30;
        recommendations.strategy = 'large_site';
        recommendations.reasoning.push(`Large site detected (${sitemapInfo.estimated_pages}+ pages)`);
      }
    }

    // Adjust based on structure complexity
    if (structureInfo.navigation_complexity === 'complex') {
      recommendations.max_pages = Math.max(recommendations.max_pages, 25);
      recommendations.max_depth = Math.max(recommendations.max_depth, 3);
      recommendations.reasoning.push('Complex navigation detected - increased limits');
    } else if (structureInfo.navigation_complexity === 'simple') {
      recommendations.max_depth = Math.min(recommendations.max_depth, 2);
      recommendations.reasoning.push('Simple navigation - focused crawl sufficient');
    }

    // Adjust based on estimated depth
    if (structureInfo.estimated_depth > 2) {
      recommendations.max_depth = Math.min(structureInfo.estimated_depth, 4);
      recommendations.reasoning.push(`Deep site structure detected (${structureInfo.estimated_depth} levels)`);
    }

    // Safety limits
    recommendations.max_pages = Math.min(recommendations.max_pages, 50);
    recommendations.max_depth = Math.min(recommendations.max_depth, 4);

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