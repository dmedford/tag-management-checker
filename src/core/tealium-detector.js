/**
 * Tealium Detection Engine
 * Detects specific Tealium instances by account and profile
 */

export class TealiumDetector {
  constructor(targetAccount, targetProfile, targetEnvironment = null) {
    this.targetAccount = targetAccount;
    this.targetProfile = targetProfile;
    this.targetEnvironment = targetEnvironment;
  }

  /**
   * Detect Tealium instance on a page
   * @param {Object} page - Puppeteer page object
   * @returns {Object} Detection results
   */
  async detectTealium(page) {
    const results = {
      found: false,
      matches: false,
      details: {},
      scripts: [],
      dataLayer: {},
      errors: []
    };

    try {
      // Check for Tealium scripts in the DOM
      const scripts = await this.findTealiumScripts(page);
      results.scripts = scripts;

      if (scripts.length === 0) {
        return results;
      }

      results.found = true;

      // Extract account and profile information
      for (const script of scripts) {
        const parsed = this.parseUtagUrl(script.src);
        if (parsed) {
          results.details = { ...results.details, ...parsed };
          
          // Check if this matches our target
          if (this.isTargetMatch(parsed)) {
            results.matches = true;
          }
        }
      }

      // Extract version information from script URLs
      const versionInfo = this.extractVersionFromScripts(scripts);
      if (versionInfo) {
        results.details = { ...results.details, ...versionInfo };
      }

      // Get utag data if available
      results.dataLayer = await this.getUtagData(page);

      // Extract version information from data layer
      if (results.dataLayer) {
        if (results.dataLayer.profile_version) {
          results.details.profile_version = results.dataLayer.profile_version;
        }
        
        if (results.dataLayer.utag_info) {
          const info = results.dataLayer.utag_info;
          results.details.utag_version = info.version;
          results.details.build_version = info.build_version;
          results.details.library_version = info.library_version;
          results.details.publish_date = info.publish_date;
        }
      }

    } catch (error) {
      results.errors.push(`Detection error: ${error.message}`);
    }

    return results;
  }

  /**
   * Find all Tealium-related scripts on the page
   */
  async findTealiumScripts(page) {
    return await page.evaluate(() => {
      const scripts = [];
      const scriptElements = document.querySelectorAll('script[src]');
      
      scriptElements.forEach(script => {
        const src = script.src;
        if (src.includes('tiqcdn.com') || 
            src.includes('utag.js') || 
            src.includes('tealium')) {
          scripts.push({
            src: src,
            async: script.async,
            defer: script.defer
          });
        }
      });

      return scripts;
    });
  }

  /**
   * Parse Tealium utag URL to extract account, profile, environment, and version
   */
  parseUtagUrl(url) {
    // Standard Tealium URL pattern:
    // https://tags.tiqcdn.com/utag/ACCOUNT/PROFILE/ENVIRONMENT/utag.js
    const regex = /tiqcdn\.com\/utag\/([^\/]+)\/([^\/]+)\/([^\/]+)\/utag\.js/;
    const match = url.match(regex);

    if (match) {
      return {
        account: match[1],
        profile: match[2],
        environment: match[3],
        fullUrl: url
      };
    }

    // Alternative patterns with version info
    const altRegex = /utag\.js\?.*account=([^&]+)/;
    const altMatch = url.match(altRegex);
    if (altMatch) {
      return {
        account: altMatch[1],
        fullUrl: url
      };
    }

    return null;
  }

  /**
   * Extract version information from Tealium script URLs
   */
  extractVersionFromScripts(scripts) {
    const versionInfo = {};
    
    for (const script of scripts) {
      const src = script.src;
      
      // Look for utv parameter in URLs (e.g., utv=ut4.49.202408091957)
      const utvMatch = src.match(/utv=([^&]+)/);
      if (utvMatch && !versionInfo.tealium_version) {
        versionInfo.tealium_version = utvMatch[1];
        
        // Parse the version format: ut4.49.202408091957
        const versionParts = utvMatch[1].match(/ut(\d+)\.(\d+)\.(\d+)/);
        if (versionParts) {
          versionInfo.utag_major_version = versionParts[1];
          versionInfo.utag_minor_version = versionParts[2];
          versionInfo.profile_build_date = versionParts[3];
        }
      }
      
      // Look for main utag.js version
      if (src.includes('/utag.js') && src.includes('tiqcdn.com')) {
        const urlParts = src.split('/');
        const environment = urlParts[urlParts.length - 2];
        if (environment && !versionInfo.detected_environment) {
          versionInfo.detected_environment = environment;
        }
      }
    }
    
    return Object.keys(versionInfo).length > 0 ? versionInfo : null;
  }

  /**
   * Check if detected Tealium matches our target criteria
   */
  isTargetMatch(detected) {
    const accountMatch = detected.account === this.targetAccount;
    const profileMatch = !this.targetProfile || detected.profile === this.targetProfile;
    const envMatch = !this.targetEnvironment || detected.environment === this.targetEnvironment;

    return accountMatch && profileMatch && envMatch;
  }

  /**
   * Extract Tealium data layer information including version details
   * Supports both utag and taxitag namespaces
   */
  async getUtagData(page) {
    return await page.evaluate(() => {
      const data = {};
      
      // Check for utag_data
      if (typeof window.utag_data !== 'undefined') {
        data.utag_data = window.utag_data;
      }

      // Check for taxitag_data (AdTaxi custom namespace)
      if (typeof window.taxitag_data !== 'undefined') {
        data.taxitag_data = window.taxitag_data;
        data.utag_data = window.taxitag_data; // Also store as utag_data for compatibility
      }

      // Check for utag object with comprehensive version info
      if (typeof window.utag !== 'undefined') {
        data.utag_info = {
          version: window.utag.cfg?.v,
          account: window.utag.cfg?.utid,
          profile: window.utag.cfg?.template,
          environment: window.utag.cfg?.env,
          build_version: window.utag.cfg?.build,
          library_version: window.utag.cfg?.template_version,
          publish_date: window.utag.cfg?.publish_date
        };
      }

      // Check for taxitag object (AdTaxi custom namespace)
      if (typeof window.taxitag !== 'undefined') {
        data.taxitag_info = {
          version: window.taxitag.cfg?.v,
          account: window.taxitag.cfg?.utid,
          profile: window.taxitag.cfg?.template,
          environment: window.taxitag.cfg?.env,
          build_version: window.taxitag.cfg?.build,
          library_version: window.taxitag.cfg?.template_version,
          publish_date: window.taxitag.cfg?.publish_date
        };
        // Also store as utag_info for compatibility
        if (!data.utag_info) {
          data.utag_info = data.taxitag_info;
        }
      }

      // Get version from data objects
      const dataObj = window.taxitag_data || window.utag_data;
      if (dataObj) {
        data.profile_version = dataObj.ut?.version || 
                             dataObj.tealium_library_version ||
                             dataObj['ut.version'];
      }

      // Check for digitalData (common data layer)
      if (typeof window.digitalData !== 'undefined') {
        data.digitalData = window.digitalData;
      }

      // Extract version from script URLs if not found in data layer
      const scripts = document.querySelectorAll('script[src*="utag.js"]');
      scripts.forEach(script => {
        const src = script.src;
        // Look for version patterns in URLs
        const versionMatch = src.match(/utag\.js\?v=([^&]+)/);
        if (versionMatch && !data.profile_version) {
          data.profile_version = versionMatch[1];
        }
      });

      return data;
    });
  }

  /**
   * Get human-readable summary of detection results
   */
  getSummary(results) {
    if (!results.found) {
      return "Tealium not found on this site";
    }

    if (results.matches) {
      const profile = results.details.profile || 'unknown';
      if (this.targetProfile) {
        return `✓ AdTaxi Tealium found! Using profile: ${profile}`;
      } else {
        return `✓ AdTaxi Tealium found! Using profile: ${profile}`;
      }
    }

    const detected = results.details;
    if (this.targetProfile) {
      return `Different Tealium found. This site uses: ${detected.account}/${detected.profile || 'unknown'} (Expected: ${this.targetAccount}/${this.targetProfile})`;
    } else {
      return `Different Tealium account found. This site uses: ${detected.account}/${detected.profile || 'unknown'} (Expected: ${this.targetAccount})`;
    }
  }
}