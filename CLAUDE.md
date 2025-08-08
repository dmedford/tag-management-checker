# Claude AI Context

This file provides context for Claude AI when working on the Tag Management Checker project.

## Project Overview

The Tag Management Checker is a comprehensive, intelligent tool designed to analyze websites for tag management implementations including Tealium and Google Tag Manager (GTM) with advanced site crawling, relationship detection, and migration tracking capabilities. It uses Cheerio + Axios for HTML parsing instead of browser automation, making it compatible with any Node.js architecture.

## Key Requirements

- **Primary Goal**: Check websites for specified Tealium account (configurable)
- **Profile Flexibility**: Accept any profile (e.g., `bubbles.tv`, `matthewsmotorswilmington.com`) under the account
- **Environment Support**: Primarily `prod`, but also support `qa` and `dev`
- **Multiple Interfaces**: Web UI, CLI, and local interface available
- **Architecture Independence**: Works on ARM64, x64, and any Node.js platform
- **Dynamic Detection**: Detects both static and JavaScript-loaded Tealium implementations
- **Site Crawling**: Intelligent multi-page website analysis with auto-discovery
- **GTM Detection**: Comprehensive Google Tag Manager container identification
- **Relationship Analysis**: GTM ↔ Tealium migration tracking and conflict detection
- **Coverage Reporting**: Gap analysis for missing tag implementations

## Project Structure

```
tag-management-checker/
├── src/
│   ├── core/              # Core detection logic
│   │   ├── cheerio-detector.js    # Main Tealium/GTM detection engine (ACTIVE)
│   │   ├── cheerio-scanner.js     # Website scanning functionality (ACTIVE)
│   │   ├── tealium-detector.js    # Legacy Puppeteer detector (BACKUP)
│   │   └── website-scanner.js     # Legacy Puppeteer scanner (BACKUP)
│   ├── utils/             # Utility functions
│   │   └── output-formatter.js    # Output formatting (console, JSON, CSV)
│   ├── cli/               # Command-line interface
│   │   └── cli.js         # CLI commands and options
│   └── index.js           # Main entry point
├── web/                   # Web interface components
│   └── public/            # Static web assets
│       ├── index.html     # Web UI (Tailwind CSS + vanilla JS)
│       └── app.js         # Frontend JavaScript with API integration
├── cheerio-web-server.js  # Web server (Cheerio-powered, ACTIVE)
├── local-interface.html   # Standalone command generator
├── config/                # Configuration files
│   └── default-config.json # Default settings
└── docs/                  # Documentation
```

## Technology Stack

- **Detection Engine**: Cheerio + Axios (lightweight HTML parsing)
- **Web Server**: Node.js HTTP (no Express.js dependency)
- **CLI Framework**: Commander.js
- **Output Styling**: Chalk (terminal colors)
- **Frontend**: Vanilla JavaScript + Tailwind CSS
- **Architecture**: Pure Node.js ES modules

## Why Cheerio Instead of Puppeteer?

**Previous Issue**: Puppeteer failed to launch Chrome on x64 Node.js running on ARM64 macOS due to Rosetta translation issues.

**Cheerio Solution**:
- ⚡ **Faster**: No browser startup time (sub-second scans)
- 🪶 **Lightweight**: Just HTTP requests + HTML parsing
- 🔧 **No Compatibility Issues**: Works on any Node.js architecture
- 🎯 **Sufficient for Tealium**: Detects both static and dynamic implementations
- 📱 **Comprehensive**: Parses inline JavaScript for dynamic script loading

## Key Commands

### Web Interface (Primary)
```bash
# Start the Cheerio-powered web server
npm run web

# Access at http://localhost:8889
# Features: 
# - Single URL check with relationship analysis
# - Batch scanning with coverage reporting
# - Intelligent site crawler with auto-discovery
# - GTM ↔ Tealium migration tracking
# - Real-time results with tabbed interface
```

### CLI Usage (Secondary)
```bash
# Check single URL with verbose output
node src/index.js check <url> --verbose

# Check multiple URLs with CSV export
node src/index.js scan <url1> <url2> --format csv --verbose

# Check with specific profile (optional)
node src/index.js check <url> --profile <profile> --verbose

# Export results to file
node src/index.js check <url> --format json > results.json
```

### Local Interface (Fallback)
```bash
# Open standalone command generator
open local-interface.html
```

## Detection Logic

The Cheerio detector provides comprehensive tag management analysis through multiple methods:

### 1. Tealium Detection

#### Static Script Detection
```html
<script src="//tags.tiqcdn.com/utag/your-account/your-profile/prod/utag.js"></script>
```

#### Dynamic Script Detection (ENHANCED)
```javascript
// Parses inline JavaScript for dynamic loading
var utag_data = {...};
a='//tags.tiqcdn.com/utag/your-account/your-profile/prod/utag.js';
// Creates script tag dynamically
```

#### URL Pattern Analysis
```
https://tags.tiqcdn.com/utag/{ACCOUNT}/{PROFILE}/{ENVIRONMENT}/utag.js
```

Examples:
- `https://tags.tiqcdn.com/utag/your-account/your-profile/prod/utag.js`
- `https://tags.tiqcdn.com/utag/your-account/another-profile/prod/utag.js`

#### Version Information Extraction
- **Tealium Version**: From utv parameter (e.g., `ut4.46.202301091855`)
- **Build Information**: Date/time from build version
- **Account/Profile/Environment**: From script URL structure

### 2. Google Tag Manager (GTM) Detection

#### Multiple Detection Patterns
1. **External Scripts**: `googletagmanager.com/gtag/js` and `googletagmanager.com/gtm.js`
2. **Inline Scripts**: GTM container IDs in JavaScript (GTM-XXXXXXX)
3. **IIFE Pattern**: `})(window,document,'script','dataLayer','GTM-XXXXX');`
4. **Function Parameters**: GTM IDs passed to functions
5. **GA4 Measurement IDs**: `G-XXXXXXXXXX` format detection
6. **Gtag Config**: `gtag('config', 'container-id')` patterns
7. **Noscript Tags**: GTM containers in `<noscript>` elements

#### Container Categorization
- **GTM Containers**: `GTM-` prefixed containers
- **GA4 Properties**: `G-` prefixed measurement IDs
- **Other Containers**: Additional tracking container formats

### 3. Relationship Analysis

#### Implementation Status Detection
- **Tealium Only**: Clean implementation (migration complete)
- **GTM Only**: Pre-migration state (migration not started)
- **Both Present**: Dual implementation (migration in progress)
- **Conflicting**: Potential duplicate tracking detected
- **Complementary**: Managed migration without conflicts

#### Conflict Detection
- **Dual Implementation**: Both systems active simultaneously
- **Analytics Duplication**: GA4 present in both GTM and Tealium
- **Severity Assessment**: High/Critical severity levels assigned

### 4. Site Crawler Intelligence

#### Auto-Discovery Features
1. **Sitemap Detection**: Automatic `sitemap.xml` discovery and parsing
2. **Site Size Estimation**: URL counting from sitemaps
3. **Navigation Analysis**: Homepage link structure assessment
4. **Depth Calculation**: URL path depth analysis
5. **Complexity Assessment**: Simple/Moderate/Complex navigation classification

#### Smart Recommendations
- **Small Sites** (≤10 pages): Conservative crawl settings
- **Medium Sites** (≤50 pages): Balanced approach
- **Large Sites** (50+ pages): Strategic sampling with higher limits
- **Complex Navigation**: Increased depth and page limits
- **Simple Structure**: Focused, efficient crawling

#### Coverage Analysis
- **Tag Implementation Coverage**: Percentage of pages with tags
- **High-Priority Page Identification**: Homepage, contact, checkout, etc.
- **Gap Reporting**: Pages missing critical tag implementations
- **Migration Progress Tracking**: GTM → Tealium conversion percentage

## Result Types

### Single URL Results
- ✅ **Match**: Target account found with profile details
- ⚠️ **Partial**: Different Tealium account/profile found
- ❌ **None**: No Tealium detected
- 🔴 **Error**: Page failed to load with verbose troubleshooting

### Relationship Analysis Results
- 🟢 **Tealium Only**: Clean implementation (no conflicts)
- 🔵 **GTM Only**: Migration opportunity identified  
- 🟡 **Both Present**: Migration in progress
- 🔴 **Conflicting**: Duplicate tracking detected
- 🟣 **Complementary**: Managed migration

### Site Crawl Results
- 📊 **Coverage Percentage**: Tag implementation across site
- 🎯 **High-Priority Gaps**: Critical pages missing tags
- 📈 **Migration Progress**: GTM → Tealium conversion rate
- 🔍 **Consistency Analysis**: Implementation uniformity

## Example Results

### Enhanced Single URL Detection
```json
{
  "url": "https://bubbles.tv/",
  "timestamp": "2025-08-08T00:35:45.450Z",
  "success": true,
  "found": true,
  "matches": true,
  "details": {
    "account": "your-account",
    "profile": "bubbles.tv",
    "environment": "prod"
  },
  "scripts": ["https://tags.tiqcdn.com/utag/your-account/your-profile/prod/utag.js"],
  "gtm": {
    "found": true,
    "containers": ["G-SCHEDULING"],
    "details": {
      "total_containers": 1,
      "container_types": {
        "gtm": [],
        "ga4": ["G-SCHEDULING"],
        "other": []
      }
    },
    "summary": "✅ Found GTM container: G-SCHEDULING"
  },
  "relationship": {
    "status": "conflicting",
    "analysis": "Conflicting implementations detected - may cause tracking issues",
    "migration_status": "in_progress",
    "recommendations": [
      "Review for duplicate tracking events",
      "Plan migration timeline to remove GTM",
      "Test for duplicate analytics events"
    ],
    "details": {
      "conflicts": [
        {
          "type": "dual_implementation",
          "severity": "high",
          "description": "Both GTM and Tealium are active - potential for duplicate tracking"
        }
      ]
    }
  },
  "summary": "✅ Found target Tealium account (your-profile)"
}
```

### Site Auto-Discovery Analysis
```json
{
  "baseUrl": "https://bubbles.tv/",
  "sitemap": {
    "found": true,
    "estimated_pages": 300
  },
  "structure": {
    "estimated_depth": 2,
    "navigation_complexity": "moderate",
    "internal_links": 14,
    "page_types": ["home", "contact", "cart"]
  },
  "recommendations": {
    "max_pages": 30,
    "max_depth": 2,
    "strategy": "large_site",
    "reasoning": ["Large site detected (300+ pages)"]
  }
}
```

## Testing Commands

Use these commands to test and maintain the project:

```bash
# Install dependencies
npm install

# Start web interface (primary method)
npm run web

# Test CLI functionality
node src/index.js check https://bubbles.tv/ --verbose
node src/index.js check https://matthewsmotorswilmington.com/ --verbose

# Test different output formats
node src/index.js check https://bubbles.tv/ --format json
node src/index.js scan https://bubbles.tv/ https://example.com --format csv

# Test error handling
node src/index.js check https://nonexistent-site-12345.com --verbose
```

## Web Interface API Endpoints

### POST /api/check
Single URL analysis with relationship detection
```javascript
// Request
{
  "url": "https://bubbles.tv/",
  "profile": null,
  "environment": "prod",
  "gtmContainer": null
}

// Response
{
  "success": true,
  "result": { 
    /* Tealium + GTM + relationship analysis results */
  },
  "engine": "cheerio"
}
```

### POST /api/scan-multiple
Batch URL analysis with coverage reporting
```javascript
// Request
{
  "urls": ["https://site1.com", "https://site2.com"],
  "profile": null,
  "environment": "prod",
  "gtmContainer": null
}

// Response
{
  "success": true,
  "results": [/* array of enhanced scan results */],
  "engine": "cheerio"
}
```

### POST /api/analyze-site
Intelligent site analysis for crawl optimization
```javascript
// Request
{
  "url": "https://bubbles.tv/"
}

// Response
{
  "success": true,
  "analysis": {
    "sitemap": { "found": true, "estimated_pages": 300 },
    "structure": { "complexity": "moderate", "estimated_depth": 2 },
    "recommendations": { "max_pages": 30, "max_depth": 2, "strategy": "large_site" }
  },
  "engine": "cheerio"
}
```

### POST /api/crawl-site
Comprehensive website crawling with coverage analysis
```javascript
// Request
{
  "url": "https://bubbles.tv/",
  "maxPages": 30,
  "maxDepth": 2,
  "profile": null,
  "environment": "prod",
  "gtmContainer": null,
  "excludePaths": ["/admin", "/wp-admin", "/private"]
}

// Response
{
  "success": true,
  "result": {
    "pages": [/* individual page results */],
    "summary": { "coverage_percentage": 85, "total_pages": 25 },
    "relationship_analysis": { "migration_progress": 60, "consistent_implementation": false }
  },
  "engine": "cheerio"
}
```

## Common Issues & Solutions

### 1. **Port Already In Use**
```bash
lsof -ti:8889 | xargs kill -9
npm run web
```

### 2. **"No Tealium implementation detected" but it exists**
- The site may load Tealium after user interaction
- Try increasing timeout: `--timeout 45000`
- Check if the site blocks automated requests

### 3. **Connection Timeouts**
- Increase timeout in CLI: `--timeout 45000`
- Check internet connection
- The site may be experiencing high load

### 4. **Different Architecture Issues**
- The Tag Management Checker works on any architecture
- No browser compatibility problems
- Puppeteer files kept as backup for reference

## Development Notes

- **Primary Engine**: Cheerio detector (`src/core/cheerio-detector.js`)
- **Web Server**: Cheerio-powered (`cheerio-web-server.js`)
- **Legacy Support**: Puppeteer files maintained but not used
- **All detection logic** is centralized in `cheerio-detector.js` for easy maintenance
- **Enhanced detection** includes parsing inline JavaScript for dynamic Tealium loading
- **Cross-platform compatibility** achieved through lightweight HTTP + HTML parsing approach

## Performance Characteristics

- **Speed**: Sub-second scanning for most websites
- **Memory**: Low memory footprint (no browser overhead)
- **Network**: Simple HTTP GET requests
- **Scalability**: Can handle batch scanning of hundreds of URLs
- **Reliability**: No browser crashes or architecture issues

## Recent Successful Tests

### Single URL Analysis
- ✅ **https://example1.com/** - Target Tealium found with GTM conflict detected (G-SCHEDULING container)
- ✅ **https://example2.com/** - Target Tealium found (profile: example2-profile)
- ❌ **https://example.com/** - No Tealium detected (expected)
- 🔴 **Connection error testing** - Verbose troubleshooting working

### Site Analysis & Auto-Discovery
- ✅ **bubbles.tv sitemap detection** - Found 300+ pages, recommended 30 pages/depth 2
- ✅ **example.com structure analysis** - Simple site, recommended 10 pages/depth 2
- ✅ **Intelligent recommendations** - Strategy selection working correctly

### GTM Detection
- ✅ **GA4 Container Detection** - Successfully identified G-SCHEDULING on bubbles.tv
- ✅ **Container Categorization** - Proper GTM vs GA4 vs Other classification
- ✅ **Multiple Detection Methods** - Inline scripts, external scripts, noscript tags

### Relationship Analysis
- ✅ **Conflict Detection** - Identified bubbles.tv dual implementation (Tealium + GTM)
- ✅ **Migration Status** - Correctly assessed "in_progress" status
- ✅ **Recommendations Engine** - Generated actionable migration advice

The Tag Management Checker now provides comprehensive tag management analysis including Tealium detection, GTM identification, relationship analysis, site crawling with intelligent auto-discovery, and migration progress tracking with enhanced coverage gap reporting separated by tag type.

## Recent Enhancements (2025-08-08)

### Enhanced User Interface
- ✅ **Tabbed Interface**: Separated URL Checker and Site Crawler into distinct tabs for better organization
- ✅ **Enhanced Coverage Analysis**: Coverage gap reporting now split into separate tabs for Tealium and GTM
- ✅ **Project Rename**: Rebranded from "Tealium Checker" to "Tag Management Checker" to reflect comprehensive capabilities

### Advanced Coverage Analysis
- ✅ **Granular Gap Reporting**: Separate coverage metrics and missing page analysis for Tealium vs GTM
- ✅ **Priority-Based Classification**: High/medium/low priority page categorization for targeted action
- ✅ **Tabbed Coverage Views**: Overview, Tealium Gaps, and GTM Gaps tabs for focused analysis
- ✅ **Enhanced Migration Tracking**: Visual progress indicators and actionable recommendations