#!/usr/bin/env node

/**
 * Tealium Checker CLI
 * Command-line interface for checking websites for specific Tealium instances
 */

import { Command } from 'commander';
import { CheerioScanner } from '../core/cheerio-scanner.js';
import { OutputFormatter } from '../utils/output-formatter.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '../../config/default-config.json');
const defaultConfig = JSON.parse(readFileSync(configPath, 'utf8'));

const program = new Command();

program
  .name('tealium-checker')
  .description('Check websites for specific Tealium instances')
  .version('1.0.0');

program
  .command('check')
  .description('Check a single URL for Tealium')
  .argument('<url>', 'URL to check')
  .option('-a, --account <account>', 'Target Tealium account', defaultConfig.defaultTarget.account)
  .option('-p, --profile <profile>', 'Target Tealium profile (optional - checks account only if not specified)')
  .option('-e, --environment <env>', 'Target environment (prod/qa/dev)', defaultConfig.defaultTarget.environment)
  .option('-f, --format <format>', 'Output format (console/json/csv)', 'console')
  .option('-v, --verbose', 'Show detailed information')
  .option('--timeout <ms>', 'Page load timeout in milliseconds', parseInt, 30000)
  .action(async (url, options) => {
    const scanner = new CheerioScanner({
      timeout: options.timeout
    });

    try {
      console.log(`Checking ${url} for Tealium instance: ${options.account}/${options.profile}/${options.environment}`);
      
      const result = await scanner.scanUrl(
        url, 
        options.account, 
        options.profile, 
        options.environment
      );

      outputResult(result, options);
      
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      await scanner.close();
    }
  });

program
  .command('scan')
  .description('Scan multiple URLs or a website\'s common pages')
  .argument('<urls...>', 'URLs to scan (or single domain for website scan)')
  .option('-a, --account <account>', 'Target Tealium account', defaultConfig.defaultTarget.account)
  .option('-p, --profile <profile>', 'Target Tealium profile', defaultConfig.defaultTarget.profile)
  .option('-e, --environment <env>', 'Target environment', defaultConfig.defaultTarget.environment)
  .option('-f, --format <format>', 'Output format (console/json/csv)', 'console')
  .option('-v, --verbose', 'Show detailed information')
  .option('--website', 'Scan common pages of a website (pass single domain)')
  .option('--timeout <ms>', 'Page load timeout in milliseconds', parseInt, 30000)
  .action(async (urls, options) => {
    const scanner = new CheerioScanner({
      timeout: options.timeout
    });

    try {
      let results;
      
      if (options.website && urls.length === 1) {
        console.log(`Scanning website ${urls[0]} for Tealium instance: ${options.account}/${options.profile}/${options.environment}`);
        results = await scanner.scanWebsite(
          urls[0], 
          options.account, 
          options.profile, 
          options.environment
        );
      } else {
        console.log(`Scanning ${urls.length} URLs for Tealium instance: ${options.account}/${options.profile}/${options.environment}`);
        results = await scanner.scanUrls(
          urls, 
          options.account, 
          options.profile, 
          options.environment
        );
      }

      outputResult(results, options);
      
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      await scanner.close();
    }
  });

/**
 * Output results in the specified format
 */
function outputResult(results, options) {
  switch (options.format?.toLowerCase()) {
    case 'json':
      console.log(OutputFormatter.formatJson(results, true));
      break;
    case 'csv':
      console.log(OutputFormatter.formatCsv(results));
      break;
    default:
      console.log(OutputFormatter.formatConsole(results, {
        verbose: options.verbose,
        showSuccess: true,
        showErrors: true
      }));
      
      // Show summary for multiple results
      if (Array.isArray(results)) {
        console.log(OutputFormatter.generateSummary(results));
      }
      break;
  }
}

program.parse();