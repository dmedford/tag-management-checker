/**
 * Output Formatting Utilities
 * Handles different output formats for scan results
 */

import chalk from 'chalk';

export class OutputFormatter {
  
  /**
   * Format results for console output
   */
  static formatConsole(results, options = {}) {
    const { verbose = false, showSuccess = true, showErrors = true } = options;
    
    if (Array.isArray(results)) {
      return results.map(result => this.formatSingleResult(result, { verbose, showSuccess, showErrors }))
                   .join('\n\n');
    }
    
    return this.formatSingleResult(results, { verbose, showSuccess, showErrors });
  }

  /**
   * Format a single result for console
   */
  static formatSingleResult(result, options = {}) {
    const { verbose = false, showSuccess = true, showErrors = true } = options;
    let output = [];

    // URL header
    output.push(chalk.bold.blue(`🌐 ${result.url}`));

    if (!result.success && showErrors) {
      output.push(chalk.red(`❌ ${result.summary}`));
      
      // Show verbose error information if available and in verbose mode
      if (verbose && result.verboseError) {
        const lines = result.verboseError.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            output.push(chalk.gray(`   ${line}`));
          } else {
            output.push('');
          }
        });
      }
      
      return output.join('\n');
    }

    // Main status
    if (result.matches) {
      output.push(chalk.green(`✅ ${result.summary}`));
    } else if (result.found) {
      output.push(chalk.yellow(`⚠️  ${result.summary}`));
    } else if (showSuccess) {
      output.push(chalk.gray(`❌ ${result.summary}`));
    }

    // Verbose details
    if (verbose && result.found) {
      if (result.details.account) {
        output.push(`   Account: ${chalk.cyan(result.details.account)}`);
      }
      if (result.details.profile) {
        output.push(`   Profile: ${chalk.cyan(result.details.profile)}`);
      }
      if (result.details.environment) {
        output.push(`   Environment: ${chalk.cyan(result.details.environment)}`);
      }
      if (result.details.tealium_version) {
        output.push(`   Tealium Version: ${chalk.magenta(result.details.tealium_version)}`);
      }
      if (result.details.utag_major_version) {
        output.push(`   Utag Version: ${chalk.magenta(`v${result.details.utag_major_version}.${result.details.utag_minor_version || '0'}`)}`);
      }
      if (result.details.profile_build_date) {
        output.push(`   Profile Build: ${chalk.gray(result.details.profile_build_date)}`);
      }
      if (result.details.profile_version) {
        output.push(`   Profile Version: ${chalk.magenta(result.details.profile_version)}`);
      }
      if (result.details.build_version) {
        output.push(`   Build Version: ${chalk.gray(result.details.build_version)}`);
      }
      if (result.details.publish_date) {
        output.push(`   Published: ${chalk.gray(result.details.publish_date)}`);
      }
      if (result.scripts?.length > 0) {
        output.push(`   Scripts found: ${result.scripts.length}`);
      }
    }

    return output.join('\n');
  }

  /**
   * Format results as JSON
   */
  static formatJson(results, pretty = false) {
    return JSON.stringify(results, null, pretty ? 2 : 0);
  }

  /**
   * Format results as CSV
   */
  static formatCsv(results) {
    const rows = Array.isArray(results) ? results : [results];
    
    const headers = ['url', 'found', 'matches', 'account', 'profile', 'environment', 'tealium_version', 'utag_version', 'profile_build_date', 'build_version', 'publish_date', 'scripts_count', 'timestamp', 'error'];
    const csvRows = [headers.join(',')];

    rows.forEach(result => {
      const row = [
        `"${result.url}"`,
        result.found || false,
        result.matches || false,
        `"${result.details?.account || ''}"`,
        `"${result.details?.profile || ''}"`,
        `"${result.details?.environment || ''}"`,
        `"${result.details?.tealium_version || ''}"`,
        `"${result.details?.utag_major_version ? `v${result.details.utag_major_version}.${result.details.utag_minor_version || '0'}` : ''}"`,
        `"${result.details?.profile_build_date || ''}"`,
        `"${result.details?.build_version || ''}"`,
        `"${result.details?.publish_date || ''}"`,
        result.scripts?.length || 0,
        `"${result.timestamp || ''}"`,
        `"${result.error || ''}"`
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Generate summary report
   */
  static generateSummary(results) {
    const resultsArray = Array.isArray(results) ? results : [results];
    
    const total = resultsArray.length;
    const successful = resultsArray.filter(r => r.success).length;
    const found = resultsArray.filter(r => r.found).length;
    const matches = resultsArray.filter(r => r.matches).length;
    const errors = resultsArray.filter(r => !r.success).length;

    const summary = [];
    summary.push(chalk.bold('\n📊 SCAN SUMMARY'));
    summary.push(`   Total URLs scanned: ${total}`);
    summary.push(`   Successful scans: ${chalk.green(successful)}`);
    summary.push(`   Tealium detected: ${chalk.blue(found)}`);
    summary.push(`   Target matches: ${chalk.green(matches)}`);
    
    if (errors > 0) {
      summary.push(`   Errors: ${chalk.red(errors)}`);
    }

    return summary.join('\n');
  }
}