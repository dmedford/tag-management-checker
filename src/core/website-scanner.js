/**
 * Website Scanner
 * Handles browser automation and page navigation for Tealium detection
 */

import puppeteer from 'puppeteer';
import { TealiumDetector } from './tealium-detector.js';

export class WebsiteScanner {
  constructor(options = {}) {
    this.options = {
      headless: options.headless !== false,
      timeout: options.timeout || 30000,
      waitForNetworkIdle: options.waitForNetworkIdle !== false,
      userAgent: options.userAgent || 'Mozilla/5.0 (compatible; TealiumChecker/1.0)',
      ...options
    };
    this.browser = null;
  }

  /**
   * Initialize browser instance
   */
  async initialize() {
    if (this.browser) return;

    this.browser = await puppeteer.launch({
      headless: this.options.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  /**
   * Scan a single URL for Tealium
   */
  async scanUrl(url, targetAccount, targetProfile, targetEnvironment = null) {
    await this.initialize();

    const detector = new TealiumDetector(targetAccount, targetProfile, targetEnvironment);
    const page = await this.browser.newPage();

    try {
      // Set user agent and timeout
      await page.setUserAgent(this.options.userAgent);
      page.setDefaultTimeout(this.options.timeout);

      // Navigate to the URL
      console.log(`Scanning: ${url}`);
      await page.goto(url, { 
        waitUntil: this.options.waitForNetworkIdle ? 'networkidle0' : 'domcontentloaded',
        timeout: this.options.timeout 
      });

      // Wait a moment for any async scripts to load
      await page.waitForTimeout(2000);

      // Detect Tealium
      const results = await detector.detectTealium(page);
      
      return {
        url,
        timestamp: new Date().toISOString(),
        success: true,
        ...results,
        summary: detector.getSummary(results)
      };

    } catch (error) {
      let humanMessage = `Unable to scan ${url}`;
      let verboseMessage = '';
      
      if (error.message.includes('timeout')) {
        humanMessage = `Site took too long to load (timeout after ${this.options.timeout/1000} seconds)`;
        verboseMessage = `The website did not fully load within the ${this.options.timeout/1000}-second timeout limit. This could be due to:\n` +
                        `• Slow server response times\n` +
                        `• Heavy page content (large images, videos, scripts)\n` +
                        `• Network connectivity issues\n` +
                        `• Server overload or maintenance\n` +
                        `• Blocking by firewalls or security systems\n\n` +
                        `Suggestions:\n` +
                        `• Try again later when the site might be faster\n` +
                        `• Use a longer timeout: --timeout 60000 (60 seconds)\n` +
                        `• Check if the site loads normally in your browser`;
      } else if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
        humanMessage = "Domain name could not be resolved";
        verboseMessage = `The domain name '${new URL(url).hostname}' could not be found. This means:\n` +
                        `• The website URL might be incorrect\n` +
                        `• The domain may have expired or been removed\n` +
                        `• There might be DNS resolution issues\n\n` +
                        `Please verify the URL is correct and the site exists.`;
      } else if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
        humanMessage = "Connection refused by the server";
        verboseMessage = `The server actively refused the connection. This could mean:\n` +
                        `• The website is temporarily down\n` +
                        `• Server maintenance is in progress\n` +
                        `• The port or service is not running\n\n` +
                        `Try again later or verify the website is accessible.`;
      } else if (error.message.includes('net::ERR_CONNECTION_TIMED_OUT')) {
        humanMessage = "Connection timed out";
        verboseMessage = `Failed to establish a connection within the timeout period. This suggests:\n` +
                        `• Network connectivity problems\n` +
                        `• Server is not responding\n` +
                        `• Firewall blocking the connection\n\n` +
                        `Check your internet connection and try again.`;
      } else if (error.message.includes('404')) {
        humanMessage = "Page not found (404 error)";
        verboseMessage = `The specific page was not found on the server. The domain exists but this particular page doesn't.\n` +
                        `Please check if the URL path is correct.`;
      } else if (error.message.includes('403') || error.message.includes('forbidden')) {
        humanMessage = "Access denied to this page";
        verboseMessage = `The server understood the request but refused access. This could be due to:\n` +
                        `• Authentication requirements\n` +
                        `• IP address blocking\n` +
                        `• Geographic restrictions\n` +
                        `• Bot detection systems`;
      } else if (error.message.includes('500')) {
        humanMessage = "Server error on this site";
        verboseMessage = `The server encountered an internal error. This is a temporary server-side issue.\n` +
                        `Try again later as the problem may resolve itself.`;
      } else if (error.message.includes('net::')) {
        humanMessage = "Network connection failed";
        verboseMessage = `A network-level error occurred: ${error.message}\n` +
                        `This typically indicates connectivity or DNS issues.`;
      }
      
      return {
        url,
        timestamp: new Date().toISOString(),
        success: false,
        found: false,
        matches: false,
        error: error.message,
        summary: humanMessage,
        verboseError: verboseMessage,
        troubleshooting: verboseMessage ? true : false
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Scan multiple URLs
   */
  async scanUrls(urls, targetAccount, targetProfile, targetEnvironment = null) {
    const results = [];
    
    for (const url of urls) {
      const result = await this.scanUrl(url, targetAccount, targetProfile, targetEnvironment);
      results.push(result);
      
      // Brief pause between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * Scan a website's common pages
   */
  async scanWebsite(baseUrl, targetAccount, targetProfile, targetEnvironment = null) {
    // Clean base URL
    const cleanUrl = baseUrl.replace(/\/$/, '');
    
    // Common pages to check
    const commonPaths = [
      '',
      '/about',
      '/contact',
      '/products',
      '/services',
      '/blog'
    ];

    const urlsToScan = commonPaths.map(path => `${cleanUrl}${path}`);
    
    return await this.scanUrls(urlsToScan, targetAccount, targetProfile, targetEnvironment);
  }

  /**
   * Close browser instance
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}