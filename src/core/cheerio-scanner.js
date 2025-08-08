import { CheerioDetector } from './cheerio-detector.js';

/**
 * Website scanner using Cheerio instead of Puppeteer
 * Lightweight, fast, and works on any Node.js architecture
 */
export class CheerioScanner {
  constructor(options = {}) {
    this.detector = new CheerioDetector(options);
  }

  /**
   * Scan a single URL for Tealium implementation
   */
  async scanUrl(url, targetAccount, targetProfile = null, environment = 'prod', targetGtmContainer = null) {
    return await this.detector.scanUrl(url, targetAccount, targetProfile, environment, targetGtmContainer);
  }

  /**
   * Scan multiple URLs for Tealium implementation
   */
  async scanUrls(urls, targetAccount, targetProfile = null, environment = 'prod', targetGtmContainer = null) {
    return await this.detector.scanUrls(urls, targetAccount, targetProfile, environment, targetGtmContainer);
  }

  /**
   * Analyze a website to recommend crawl parameters
   */
  async analyzeSite(baseUrl) {
    return await this.detector.analyzeSite(baseUrl);
  }

  /**
   * Crawl a website to discover pages and analyze tag coverage
   */
  async crawlSite(baseUrl, options = {}) {
    return await this.detector.crawlSite(baseUrl, options);
  }

  /**
   * Close method for compatibility with Puppeteer scanner
   */
  async close() {
    // Nothing to close with Cheerio - just for API compatibility
  }
}