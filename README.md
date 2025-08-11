# Tag Management Checker

A comprehensive tool to detect and analyze tag management implementations (Tealium, GTM) on websites with advanced site crawling, migration analysis, and relationship detection capabilities.

## ✨ Features

- 🔍 **Accurate Detection**: Finds both static and dynamic Tealium and GTM implementations
- ⚡ **Lightweight & Fast**: Uses Cheerio + Axios (no browser overhead)
- 🌐 **Multiple Interfaces**: Web UI, CLI, and local interface
- 🎯 **Configurable**: Flexible account targeting for any Tealium implementation
- 📊 **Comprehensive Analysis**: Version detection, profile identification, environment verification
- 🛠️ **Robust Error Handling**: Verbose troubleshooting for connection issues
- 🏗️ **Architecture Independent**: Works on any Node.js architecture (ARM64, x64)
- 🕷️ **Intelligent Site Crawler**: Auto-discover and analyze entire websites
- 🔄 **GTM ↔ Tealium Analysis**: Detect relationships and migration progress
- 🤖 **Smart Recommendations**: AI-powered crawl parameter optimization
- 📈 **Coverage Gap Reporting**: Identify pages missing tag implementations

## 🚀 Quick Start

### Web Interface (Recommended)
```bash
npm install
npm run web
```
Then open **http://localhost:8889** in your browser.

### Command Line Interface
```bash
# Check single URL
node src/index.js check https://bubbles.tv/ --verbose

# Scan multiple URLs
node src/index.js scan https://site1.com https://site2.com --format csv

# Export results
node src/index.js check https://bubbles.tv/ --format json > results.json
```

### Site Crawler
```bash
# Analyze site structure and get recommendations
curl -X POST http://localhost:8889/api/analyze-site \
  -H "Content-Type: application/json" \
  -d '{"url":"https://bubbles.tv/"}'

# Crawl entire website (via web interface)
# 1. Open http://localhost:8889
# 2. Enter URL in "Site Crawl" section
# 3. Click "Auto-Discover" for intelligent recommendations
# 4. Click "Crawl Site" for comprehensive analysis
```

### Local Interface (No Server)
```bash
open local-interface.html
```
Generates CLI commands with a visual interface.

## 📋 What It Detects

### 🏷️ Tealium Implementation Detection
- **Account**: Configurable target account
- **Profile**: `bubbles.tv`, `darvin.com`, etc.
- **Environment**: `prod`, `qa`, `dev`
- **Version Information**: Tealium version, build dates, utag versions
- **Script Count**: Number of Tealium-related scripts
- **Implementation Type**: Static HTML or JavaScript-loaded

### 📊 Google Tag Manager (GTM) Detection
- **GTM Containers**: `GTM-XXXXXXX` format containers
- **GA4 Properties**: `G-XXXXXXXXXX` measurement IDs
- **Container Types**: Automatic categorization of container types
- **Total Container Count**: Comprehensive container inventory

### 🔄 GTM ↔ Tealium Relationship Analysis
- **Implementation Status**: Tealium-only, GTM-only, or dual implementation
- **Migration Progress**: Percentage of GTM → Tealium migration completion
- **Conflict Detection**: Identifies potential duplicate tracking scenarios
- **Recommendations**: Actionable advice for migration and optimization

### 🕷️ Site Crawler Capabilities
- **Multi-page Discovery**: Automatic link following and page discovery
- **Tag Coverage Analysis**: Percentage of pages with proper tag implementation
- **Missing Tag Identification**: High-priority pages without tag management
- **Site Structure Analysis**: Navigation complexity and depth assessment
- **Intelligent Recommendations**: AI-powered crawl parameter optimization

### 🔍 Detection Methods
1. **Static Script Tags**: `<script src="//tags.tiqcdn.com/utag/..."></script>`
2. **Dynamic Loading**: JavaScript that creates Tealium scripts after page load
3. **Data Layer**: `utag_data` objects and configuration
4. **GTM Script Analysis**: Multiple detection patterns for GTM containers
5. **Sitemap Integration**: Automatic sitemap.xml discovery and parsing
6. **Navigation Analysis**: Link structure and site complexity assessment

## 📊 Example Results

### Single URL Check Result
```json
{
  "url": "https://bubbles.tv/",
  "success": true,
  "found": true,
  "matches": true,
  "details": {
    "account": "adtaxi",
    "profile": "bubbles.tv",
    "environment": "prod",
    "tealium_version": "4.46",
    "build_version": "202301091855"
  },
  "gtm": {
    "found": true,
    "containers": ["G-SCHEDULING"],
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
    ]
  },
  "summary": "✅ Found AdTaxi Tealium account (bubbles.tv) - Version 4.46"
}
```

### Site Crawl Result
```json
{
  "baseUrl": "https://example.com/",
  "pages": [
    {"url": "https://example.com/", "found": true, "matches": true},
    {"url": "https://example.com/about/", "found": false, "matches": false},
    {"url": "https://example.com/contact/", "found": true, "matches": true}
  ],
  "summary": {
    "total_pages": 3,
    "pages_with_tealium": 2,
    "pages_with_gtm": 1,
    "coverage_percentage": 67
  },
  "relationship_analysis": {
    "consistent_implementation": false,
    "migration_progress": 75,
    "patterns": {
      "tealium_only_pages": ["https://example.com/contact/"],
      "gtm_only_pages": ["https://example.com/about/"],
      "both_tags_pages": ["https://example.com/"]
    }
  }
}
```

### Auto-Discovery Analysis
```json
{
  "sitemap": {
    "found": true,
    "estimated_pages": 300
  },
  "structure": {
    "estimated_depth": 2,
    "navigation_complexity": "moderate",
    "internal_links": 14
  },
  "recommendations": {
    "max_pages": 30,
    "max_depth": 2,
    "strategy": "large_site",
    "reasoning": ["Large site detected (300+ pages)"]
  }
}
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+ (any architecture)
- npm or yarn

### Install Dependencies
```bash
npm install
```

### Available Scripts
```bash
npm run web          # Start web interface (Cheerio-powered)
npm run start        # CLI interface
npm run dev          # Development mode with file watching
```

## 🌐 Web Interface

The Tag Management Checker web interface provides:

- **Single URL Checker**: Enter any URL and get instant results
- **Batch Scanner**: Check multiple URLs at once
- **Site Crawler**: Analyze entire websites with intelligent auto-discovery
- **Real-time Results**: Color-coded status indicators with tabbed views
- **Verbose Troubleshooting**: Detailed error messages for failed scans
- **Export Options**: JSON and CSV output formats
- **No Setup Required**: Works immediately after `npm run web`

### Web Interface Features
- 🎯 **Target Account**: Configurable for any Tealium account detection
- 🔄 **Profile Flexibility**: Accepts any profile under target account
- 📱 **Mobile Friendly**: Responsive design for all devices
- ⚡ **Fast Scanning**: Sub-second response times
- 🛡️ **Error Resilience**: Handles timeouts, DNS issues, and connection problems
- 🤖 **Auto-Discovery**: Intelligent site analysis with crawl recommendations
- 📊 **Multi-tab Results**: Separate views for Tealium, GTM, and Relationship data
- 🔄 **Migration Tracking**: Visual progress bars for GTM → Tealium migrations
- 📈 **Coverage Analysis**: Gap reporting with high-priority page identification

### Advanced Features
- **Sitemap Detection**: Automatic sitemap.xml discovery and parsing
- **Smart Recommendations**: AI-powered crawl parameter optimization
- **Conflict Detection**: Identifies GTM/Tealium implementation conflicts
- **Migration Progress**: Tracks and visualizes tag management migrations
- **Coverage Gaps**: Highlights pages missing critical tag implementations

## 🖥️ Command Line Interface

### Basic Usage
```bash
# Check if a website uses your Tealium implementation
node src/index.js check https://example.com/

# Verbose output with troubleshooting info
node src/index.js check https://example.com/ --verbose

# Scan multiple URLs
node src/index.js scan https://site1.com https://site2.com https://site3.com

# Specify output format
node src/index.js check https://example.com/ --format json
node src/index.js scan https://site1.com https://site2.com --format csv
```

### Advanced Options
```bash
# Check specific profile (optional)
node src/index.js check https://example.com/ --profile specific-profile

# Check different environment
node src/index.js check https://example.com/ --environment qa

# Increase timeout for slow sites
node src/index.js check https://example.com/ --timeout 45000

# Export results to file
node src/index.js check https://example.com/ --format json > tealium-report.json
```

### Output Formats
- **Console** (default): Color-coded, human-readable output
- **JSON**: Structured data for programmatic use
- **CSV**: Spreadsheet-compatible format for reports

## 🔌 API Endpoints

The Tag Management Checker web server provides RESTful API endpoints for programmatic access:

### Single URL Check
```bash
POST /api/check
Content-Type: application/json

{
  "url": "https://bubbles.tv/",
  "profile": null,
  "environment": "prod",
  "gtmContainer": null
}
```

### Multiple URL Scan
```bash
POST /api/scan-multiple
Content-Type: application/json

{
  "urls": ["https://site1.com", "https://site2.com"],
  "profile": null,
  "environment": "prod",
  "gtmContainer": null
}
```

### Site Analysis (Auto-Discovery)
```bash
POST /api/analyze-site
Content-Type: application/json

{
  "url": "https://bubbles.tv/"
}
```

### Site Crawl
```bash
POST /api/crawl-site
Content-Type: application/json

{
  "url": "https://bubbles.tv/",
  "maxPages": 30,
  "maxDepth": 2,
  "profile": null,
  "environment": "prod",
  "gtmContainer": null,
  "excludePaths": ["/admin", "/wp-admin", "/private"]
}
```

### Health Check
```bash
GET /health
```

## 🏗️ Architecture

### Core Components
```
src/
├── core/
│   ├── cheerio-detector.js    # Main Tealium detection logic
│   ├── cheerio-scanner.js     # Website scanning functionality
│   ├── tealium-detector.js    # Legacy Puppeteer detector (backup)
│   └── website-scanner.js     # Legacy Puppeteer scanner (backup)
├── utils/
│   └── output-formatter.js    # Output formatting and display
├── cli/
│   └── cli.js                 # Command-line interface
└── index.js                   # Main entry point
```

### Web Interface
```
web/
├── public/
│   ├── index.html             # Web interface UI
│   └── app.js                 # Frontend JavaScript
cheerio-web-server.js          # Web server (Cheerio-powered)
local-interface.html           # Standalone command generator
```

## 🎯 Technology Stack

- **Detection Engine**: Cheerio + Axios (lightweight HTML parsing)
- **Web Server**: Node.js HTTP (no Express.js overhead)
- **CLI Framework**: Commander.js
- **Output Styling**: Chalk (terminal colors)
- **Frontend**: Vanilla JavaScript + Tailwind CSS

### Why Cheerio?
We use Cheerio instead of browser automation tools because:
- ⚡ **Faster**: No browser startup time
- 🪶 **Lightweight**: Just HTTP requests + HTML parsing
- 🔧 **No Compatibility Issues**: Works on any Node.js architecture
- 🎯 **Sufficient for Tealium**: Detects both static and dynamic implementations

## 🔧 Configuration

### Default Settings
The Tag Management Checker has these default settings:
- **Target Account**: `adtaxi` (configurable via env var)
- **Environment**: `prod`
- **Timeout**: 30 seconds
- **Profile**: Any (flexible matching)
- **Smart Result Messaging**: AdTaxi accounts show as success ✅ instead of warnings

### Custom Configuration

#### Environment Variables
```bash
export TARGET_ACCOUNT="your-account"  # Default: adtaxi
export PORT=8889                      # Default: 8889
```

#### Config File (Optional)
Create `config/custom-config.json`:
```json
{
  "targetAccount": "your-account",
  "defaultEnvironment": "prod", 
  "timeout": 30000,
  "userAgent": "TagManagementChecker/1.0.0"
}
```

#### Advanced Bot Detection Handling
The tool includes advanced bot detection evasion:
- **Crawlee Fallback**: For sites with sophisticated bot protection
- **Human Behavior Simulation**: Mouse movements, scrolling patterns
- **Enhanced Headers**: Realistic browser fingerprinting
- **Multiple User Agents**: Rotates between browser profiles

## 🚨 Troubleshooting

### Common Issues

**"No Tealium implementation detected" but you know it's there**
- ✅ Try the verbose flag: `--verbose`
- ✅ Check if site loads Tealium after user interaction  
- ✅ Some sites may block automated requests - Crawlee fallback will automatically engage
- ✅ Bot protection detected - enhanced browser simulation will trigger automatically

**Connection timeouts**
- ✅ Increase timeout: `--timeout 45000`
- ✅ Check your internet connection
- ✅ The site may be experiencing high load

**DNS resolution errors**
- ✅ Verify the URL is correct
- ✅ Try with `www.` prefix
- ✅ Check if the site is accessible in your browser

### Verbose Mode
Use `--verbose` for detailed troubleshooting information:
```bash
node src/index.js check https://example.com/ --verbose
```

This provides:
- Step-by-step scanning process
- HTTP response details
- Script analysis information
- Detailed error messages with suggestions

## 📈 Performance

- **Speed**: Sub-second scanning for most websites
- **Memory**: Low memory footprint (no browser)
- **Scalability**: Can handle batch scanning of hundreds of URLs
- **Architecture**: Works on ARM64, x64, and any Node.js platform

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development
```bash
# Development mode with file watching
npm run dev

# Test individual components
node src/core/cheerio-detector.js
```

## 📄 License

MIT License - see LICENSE file for details.

## 🏢 About

A comprehensive tool designed to streamline tag management verification across websites. The Tag Management Checker helps ensure proper implementation of Tealium, GTM, and other tag management solutions while providing comprehensive migration analysis.

### Key Benefits
- ✅ **Quality Assurance**: Verify client implementations across entire websites
- ✅ **Migration Management**: Track and manage GTM → Tealium migrations
- ✅ **Troubleshooting**: Identify configuration issues and conflicts
- ✅ **Coverage Analysis**: Ensure comprehensive tag deployment
- ✅ **Reporting**: Generate detailed implementation and migration reports
- ✅ **Onboarding**: Quick verification of new client setups with comprehensive tag analysis
- ✅ **Maintenance**: Regular audits with intelligent crawling and gap identification
- ✅ **Migration Management**: End-to-end GTM → Tealium migration tracking and optimization
- ✅ **Strategic Planning**: Data-driven insights for tag management and optimization strategies