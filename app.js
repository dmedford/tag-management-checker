class TealiumChecker {
    constructor() {
        this.initializeTheme();
        this.initializeEventListeners();
    }

    initializeTheme() {
        // Check for saved theme preference or default to light mode
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        
        this.setTheme(theme);
    }

    setTheme(theme) {
        const html = document.documentElement;
        const themeIcon = document.getElementById('theme-icon');
        
        if (theme === 'dark') {
            html.classList.add('dark');
            themeIcon.className = 'fas fa-sun';
            localStorage.setItem('theme', 'dark');
        } else {
            html.classList.remove('dark');
            themeIcon.className = 'fas fa-moon';
            localStorage.setItem('theme', 'light');
        }
    }

    toggleTheme() {
        const html = document.documentElement;
        const isDark = html.classList.contains('dark');
        this.setTheme(isDark ? 'light' : 'dark');
    }

    initializeTabs() {
        const urlCheckerTab = document.getElementById('url-checker-tab');
        const siteCrawlerTab = document.getElementById('site-crawler-tab');
        const urlCheckerContent = document.getElementById('url-checker-content');
        const siteCrawlerContent = document.getElementById('site-crawler-content');

        // Set initial active tab
        this.setActiveTab('url-checker');

        urlCheckerTab.addEventListener('click', () => {
            this.setActiveTab('url-checker');
        });

        siteCrawlerTab.addEventListener('click', () => {
            this.setActiveTab('site-crawler');
        });
    }

    setActiveTab(tabName) {
        // Get tab elements
        const urlCheckerTab = document.getElementById('url-checker-tab');
        const siteCrawlerTab = document.getElementById('site-crawler-tab');
        const urlCheckerContent = document.getElementById('url-checker-content');
        const siteCrawlerContent = document.getElementById('site-crawler-content');

        // Remove active classes
        [urlCheckerTab, siteCrawlerTab].forEach(tab => {
            tab.classList.remove('border-blue-500', 'text-blue-600', 'dark:text-blue-400');
            tab.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'dark:text-gray-400', 'dark:hover:text-gray-300');
        });

        // Hide all content
        [urlCheckerContent, siteCrawlerContent].forEach(content => {
            content.classList.add('hidden');
        });

        // Show active tab
        if (tabName === 'url-checker') {
            urlCheckerTab.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'dark:text-gray-400', 'dark:hover:text-gray-300');
            urlCheckerTab.classList.add('border-blue-500', 'text-blue-600', 'dark:text-blue-400');
            urlCheckerContent.classList.remove('hidden');
        } else if (tabName === 'site-crawler') {
            siteCrawlerTab.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'dark:text-gray-400', 'dark:hover:text-gray-300');
            siteCrawlerTab.classList.add('border-purple-500', 'text-purple-600', 'dark:text-purple-400');
            siteCrawlerContent.classList.remove('hidden');
        }
    }

    initializeEventListeners() {
        // Tab switching functionality
        this.initializeTabs();
        
        document.getElementById('check-single').addEventListener('click', () => {
            this.checkSingle();
        });

        document.getElementById('check-multiple').addEventListener('click', () => {
            this.checkMultiple();
        });

        document.getElementById('crawl-site').addEventListener('click', () => {
            this.crawlSite();
        });

        document.getElementById('analyze-site').addEventListener('click', () => {
            this.analyzeSite();
        });

        document.getElementById('apply-recommendations').addEventListener('click', () => {
            this.applyRecommendations();
        });

        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Allow Enter key to trigger single URL check
        document.getElementById('single-url').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkSingle();
            }
        });
    }

    async checkSingle() {
        const url = document.getElementById('single-url').value.trim();
        if (!url) {
            this.showError('Please enter a URL');
            return;
        }

        const requestData = {
            url: url,
            profile: document.getElementById('target-profile').value.trim() || null,
            environment: document.getElementById('target-environment').value,
            gtmContainer: document.getElementById('target-gtm-container').value.trim() || null
        };

        console.log('🚀 Starting single URL check...');
        console.log('📝 Request data:', requestData);

        this.showLoading();
        
        try {
            console.log('🌐 Sending API request to /api/check');
            const response = await fetch('/api/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            console.log('📡 API response status:', response.status);
            const data = await response.json();
            console.log('📄 API response data:', data);
            
            if (data.success) {
                console.log('✅ API call successful, displaying results');
                console.log('🔍 Result summary:');
                console.log('   • Tealium found:', data.result.found);
                console.log('   • GTM found:', data.result.gtm?.found || false);
                console.log('   • GTM containers:', data.result.gtm?.containers || []);
                this.displayResults([data.result]);
            } else {
                console.log('❌ API call failed:', data.error);
                this.showError(data.error);
            }
        } catch (error) {
            console.log('💥 Network error occurred:', error);
            this.showError(`Network error: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async checkMultiple() {
        const urlsText = document.getElementById('multiple-urls').value.trim();
        if (!urlsText) {
            this.showError('Please enter URLs (one per line)');
            return;
        }

        const urls = urlsText.split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);

        if (urls.length === 0) {
            this.showError('Please enter valid URLs');
            return;
        }

        this.showLoading();

        try {
            const response = await fetch('/api/scan-multiple', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    urls: urls,
                    profile: document.getElementById('target-profile').value.trim() || null,
                    environment: document.getElementById('target-environment').value,
                    gtmContainer: document.getElementById('target-gtm-container').value.trim() || null
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.displayResults(data.results);
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            this.showError(`Network error: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async analyzeSite() {
        const url = document.getElementById('crawl-url').value.trim();
        if (!url) {
            this.showError('Please enter a URL to analyze');
            return;
        }

        console.log('🔍 Starting site analysis...');
        console.log('📝 Analyzing URL:', url);

        // Show loading state on analyze button
        const analyzeButton = document.getElementById('analyze-site');
        const originalText = analyzeButton.innerHTML;
        analyzeButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Analyzing...';
        analyzeButton.disabled = true;
        
        try {
            console.log('🌐 Sending API request to /api/analyze-site');
            const response = await fetch('/api/analyze-site', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url })
            });

            console.log('📡 API response status:', response.status);
            const data = await response.json();
            console.log('📄 API response data:', data);
            
            if (data.success) {
                console.log('✅ Site analysis successful');
                console.log('🔍 Analysis summary:');
                console.log('   • Estimated pages:', data.analysis.sitemap?.estimated_pages || 'Unknown');
                console.log('   • Complexity:', data.analysis.structure?.navigation_complexity || 'Unknown');
                console.log('   • Recommended pages:', data.analysis.recommendations?.max_pages || 'Unknown');
                console.log('   • Recommended depth:', data.analysis.recommendations?.max_depth || 'Unknown');
                
                this.displaySiteAnalysis(data.analysis);
                this.currentAnalysis = data.analysis; // Store for applying recommendations
            } else {
                console.log('❌ Site analysis failed:', data.error);
                this.showError(data.error);
            }
        } catch (error) {
            console.log('💥 Network error occurred:', error);
            this.showError(`Network error: ${error.message}`);
        } finally {
            // Reset analyze button
            analyzeButton.innerHTML = originalText;
            analyzeButton.disabled = false;
        }
    }

    displaySiteAnalysis(analysis) {
        const analysisContainer = document.getElementById('site-analysis');
        const analysisContent = document.getElementById('analysis-content');
        
        const recommendations = analysis.recommendations || {};
        const sitemap = analysis.sitemap || {};
        const structure = analysis.structure || {};
        
        let content = '<div class="space-y-2">';
        
        // Site Overview
        content += '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">';
        content += `
            <div class="text-center p-2 bg-white dark:bg-indigo-900/30 rounded border">
                <div class="text-lg font-bold text-indigo-600">${sitemap.estimated_pages || 'Unknown'}</div>
                <div class="text-xs text-indigo-600 dark:text-indigo-400">Estimated Pages</div>
            </div>
            <div class="text-center p-2 bg-white dark:bg-indigo-900/30 rounded border">
                <div class="text-lg font-bold text-indigo-600">${structure.estimated_depth || 1}</div>
                <div class="text-xs text-indigo-600 dark:text-indigo-400">Est. Depth</div>
            </div>
            <div class="text-center p-2 bg-white dark:bg-indigo-900/30 rounded border">
                <div class="text-lg font-bold text-indigo-600 capitalize">${structure.navigation_complexity || 'Simple'}</div>
                <div class="text-xs text-indigo-600 dark:text-indigo-400">Complexity</div>
            </div>
        `;
        content += '</div>';
        
        // Recommendations
        if (recommendations.max_pages && recommendations.max_depth) {
            content += `
                <div class="bg-indigo-100 dark:bg-indigo-900/40 p-3 rounded border border-indigo-300 dark:border-indigo-700">
                    <div class="font-medium text-indigo-800 dark:text-indigo-200 mb-2">
                        <i class="fas fa-robot mr-1"></i>Intelligent Recommendations:
                    </div>
                    <div class="grid grid-cols-2 gap-3 mb-2">
                        <div class="text-center p-2 bg-indigo-200 dark:bg-indigo-800/50 rounded">
                            <div class="text-xl font-bold text-indigo-800 dark:text-indigo-200">${recommendations.max_pages}</div>
                            <div class="text-xs text-indigo-700 dark:text-indigo-300">Max Pages</div>
                        </div>
                        <div class="text-center p-2 bg-indigo-200 dark:bg-indigo-800/50 rounded">
                            <div class="text-xl font-bold text-indigo-800 dark:text-indigo-200">${recommendations.max_depth}</div>
                            <div class="text-xs text-indigo-700 dark:text-indigo-300">Max Depth</div>
                        </div>
                    </div>
                    <div class="text-xs text-indigo-700 dark:text-indigo-300">
                        <strong>Strategy:</strong> ${recommendations.strategy || 'Standard'}
                    </div>
                </div>
            `;
        }
        
        // Reasoning
        if (recommendations.reasoning && recommendations.reasoning.length > 0) {
            content += `
                <div class="text-xs">
                    <div class="font-medium text-indigo-800 dark:text-indigo-200 mb-1">Why these settings?</div>
                    <ul class="list-disc ml-4 space-y-1">
                        ${recommendations.reasoning.map(reason => `<li>${reason}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        // Sitemap info
        if (sitemap.found) {
            content += `
                <div class="text-xs bg-green-100 dark:bg-green-900/30 p-2 rounded border border-green-300 dark:border-green-700">
                    <i class="fas fa-check-circle text-green-600 mr-1"></i>
                    <strong>Sitemap detected!</strong> Found ${sitemap.estimated_pages} pages in sitemap.xml
                </div>
            `;
        }
        
        content += '</div>';
        
        analysisContent.innerHTML = content;
        analysisContainer.classList.remove('hidden');
    }

    applyRecommendations() {
        if (!this.currentAnalysis || !this.currentAnalysis.recommendations) {
            console.log('No recommendations to apply');
            return;
        }

        const recommendations = this.currentAnalysis.recommendations;
        
        // Apply to form fields
        if (recommendations.max_pages) {
            document.getElementById('max-pages').value = recommendations.max_pages;
        }
        if (recommendations.max_depth) {
            document.getElementById('max-depth').value = recommendations.max_depth;
        }

        console.log('✅ Applied recommendations:', recommendations);
        
        // Visual feedback
        const applyButton = document.getElementById('apply-recommendations');
        const originalText = applyButton.textContent;
        applyButton.textContent = 'Applied!';
        applyButton.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
        applyButton.classList.add('bg-green-600');
        
        setTimeout(() => {
            applyButton.textContent = originalText;
            applyButton.classList.remove('bg-green-600');
            applyButton.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
        }, 2000);
    }

    async crawlSite() {
        const url = document.getElementById('crawl-url').value.trim();
        if (!url) {
            this.showError('Please enter a URL to crawl');
            return;
        }

        const requestData = {
            url: url,
            profile: document.getElementById('target-profile').value.trim() || null,
            environment: document.getElementById('target-environment').value,
            gtmContainer: document.getElementById('target-gtm-container').value.trim() || null,
            maxPages: parseInt(document.getElementById('max-pages').value) || 10,
            maxDepth: parseInt(document.getElementById('max-depth').value) || 2,
            excludePaths: ['/admin', '/wp-admin', '/private']
        };

        console.log('🕷️ Starting site crawl...');
        console.log('📝 Crawl request data:', requestData);

        this.showLoading();
        
        try {
            console.log('🌐 Sending API request to /api/crawl-site');
            const response = await fetch('/api/crawl-site', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            console.log('📡 API response status:', response.status);
            const data = await response.json();
            console.log('📄 API response data:', data);
            
            if (data.success) {
                console.log('✅ Site crawl successful, displaying results');
                console.log('🔍 Crawl summary:');
                console.log('   • Total pages:', data.result.pages?.length || 0);
                console.log('   • Coverage:', data.result.summary?.coverage_percentage || 0, '%');
                this.displayCrawlResults(data.result);
            } else {
                console.log('❌ Site crawl failed:', data.error);
                this.showError(data.error);
            }
        } catch (error) {
            console.log('💥 Network error occurred:', error);
            this.showError(`Network error: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    displayCrawlResults(crawlResult) {
        const resultsContainer = document.getElementById('results');
        const resultsContent = document.getElementById('results-content');
        
        resultsContent.innerHTML = '';

        // Update results header for crawl
        const resultsHeader = resultsContainer.querySelector('h3');
        resultsHeader.innerHTML = `
            <i class="fas fa-sitemap text-purple-600 mr-2"></i>
            Site Crawl Results - ${crawlResult.baseUrl}
        `;

        // Crawl Summary
        const summary = crawlResult.summary || {};
        const crawlSummary = document.createElement('div');
        crawlSummary.className = 'mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800';
        crawlSummary.innerHTML = `
            <h4 class="font-semibold text-purple-800 dark:text-purple-200 mb-3">
                <i class="fas fa-chart-pie mr-1"></i>Crawl Summary
            </h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                <div class="text-center">
                    <div class="text-2xl font-bold text-purple-600">${summary.total_pages || 0}</div>
                    <div class="text-purple-600 dark:text-purple-400">Total Pages</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-600">${summary.coverage_percentage || 0}%</div>
                    <div class="text-purple-600 dark:text-purple-400">Tag Coverage</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-blue-600">${summary.pages_with_tealium || 0}</div>
                    <div class="text-purple-600 dark:text-purple-400">Tealium Pages</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-yellow-600">${summary.pages_with_gtm || 0}</div>
                    <div class="text-purple-600 dark:text-purple-400">GTM Pages</div>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div class="text-center p-2 bg-white dark:bg-purple-900/30 rounded border">
                    <div class="text-lg font-bold text-orange-600">${summary.pages_with_both || 0}</div>
                    <div class="text-purple-600 dark:text-purple-400">Both Tags</div>
                </div>
                <div class="text-center p-2 bg-white dark:bg-purple-900/30 rounded border">
                    <div class="text-lg font-bold text-gray-600">${summary.pages_with_neither || 0}</div>
                    <div class="text-purple-600 dark:text-purple-400">No Tags</div>
                </div>
            </div>
        `;
        resultsContent.appendChild(crawlSummary);

        // Migration Progress (if applicable)
        if (crawlResult.relationship_analysis && crawlResult.relationship_analysis.migration_progress > 0) {
            const migrationAnalysis = document.createElement('div');
            migrationAnalysis.className = 'mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800';
            migrationAnalysis.innerHTML = `
                <h4 class="font-semibold text-blue-800 dark:text-blue-200 mb-3">
                    <i class="fas fa-exchange-alt mr-1"></i>Migration Analysis
                </h4>
                <div class="mb-3">
                    <div class="flex justify-between text-sm text-blue-700 dark:text-blue-300 mb-1">
                        <span>Migration Progress</span>
                        <span>${crawlResult.relationship_analysis.migration_progress}%</span>
                    </div>
                    <div class="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full transition-all" style="width: ${crawlResult.relationship_analysis.migration_progress}%"></div>
                    </div>
                </div>
                <div class="text-sm text-blue-700 dark:text-blue-300">
                    <div class="mb-1">
                        <strong>Implementation Status:</strong> 
                        ${crawlResult.relationship_analysis.consistent_implementation ? 'Consistent' : 'Inconsistent'}
                    </div>
                    ${crawlResult.relationship_analysis.inconsistencies?.length ? `
                    <div>
                        <strong>Issues:</strong> ${crawlResult.relationship_analysis.inconsistencies.join(', ')}
                    </div>
                    ` : ''}
                </div>
            `;
            resultsContent.appendChild(migrationAnalysis);
        }

        // Enhanced Coverage Gap Analysis with separate tabs
        this.addEnhancedCoverageAnalysis(resultsContent, crawlResult);

        // Individual page results
        if (crawlResult.pages && crawlResult.pages.length > 0) {
            const pagesHeader = document.createElement('div');
            pagesHeader.className = 'mb-4';
            pagesHeader.innerHTML = `
                <h4 class="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    <i class="fas fa-file-alt mr-1"></i>Page-by-Page Results (${crawlResult.pages.length} pages)
                </h4>
            `;
            resultsContent.appendChild(pagesHeader);

            crawlResult.pages.forEach((pageResult, index) => {
                const pageCard = this.createResultCard(pageResult);
                // Add depth indicator
                const depthIndicator = document.createElement('div');
                depthIndicator.className = 'text-xs text-purple-600 dark:text-purple-400 mb-2';
                depthIndicator.innerHTML = `<i class="fas fa-layer-group mr-1"></i>Depth: ${pageResult.depth || 0}`;
                pageCard.insertBefore(depthIndicator, pageCard.firstChild);
                resultsContent.appendChild(pageCard);
            });
        }

        resultsContainer.classList.remove('hidden');
    }

    addEnhancedCoverageAnalysis(resultsContent, crawlResult) {
        const summary = crawlResult.summary || {};
        const tealiumCoverage = summary.tealium_coverage || {};
        const gtmCoverage = summary.gtm_coverage || {};
        
        // Only show analysis if there are gaps to report
        if (!tealiumCoverage.pages_without_tealium && !gtmCoverage.pages_without_gtm) {
            return;
        }

        const coverageAnalysis = document.createElement('div');
        coverageAnalysis.className = 'mb-6';
        
        const randomId = Math.random().toString(36).substr(2, 9);
        const overviewTabId = `coverage-overview-${randomId}`;
        const tealiumTabId = `coverage-tealium-${randomId}`;
        const gtmTabId = `coverage-gtm-${randomId}`;

        coverageAnalysis.innerHTML = `
            <div class="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <h4 class="font-semibold text-orange-800 dark:text-orange-200 mb-4">
                    <i class="fas fa-chart-line mr-1"></i>Coverage Gap Analysis
                </h4>
                
                <!-- Coverage Tab Navigation -->
                <div class="flex border-b border-orange-200 dark:border-orange-600 mb-4">
                    <button 
                        class="coverage-tab-button px-4 py-2 text-sm font-medium border-b-2 border-orange-600 dark:border-orange-400 text-orange-600 dark:text-orange-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none transition-colors" 
                        onclick="switchCoverageTab('${overviewTabId}', '${tealiumTabId},${gtmTabId}', this)"
                    >
                        <i class="fas fa-chart-pie mr-1"></i>Overview
                    </button>
                    <button 
                        class="coverage-tab-button px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none transition-colors" 
                        onclick="switchCoverageTab('${tealiumTabId}', '${overviewTabId},${gtmTabId}', this)"
                    >
                        <i class="fas fa-tag mr-1"></i>Tealium Gaps
                        ${tealiumCoverage.pages_without_tealium ? `<span class="ml-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 px-1 rounded">${tealiumCoverage.pages_without_tealium}</span>` : ''}
                    </button>
                    <button 
                        class="coverage-tab-button px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none transition-colors" 
                        onclick="switchCoverageTab('${gtmTabId}', '${overviewTabId},${tealiumTabId}', this)"
                    >
                        <i class="fab fa-google mr-1"></i>GTM Gaps
                        ${gtmCoverage.pages_without_gtm ? `<span class="ml-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 px-1 rounded">${gtmCoverage.pages_without_gtm}</span>` : ''}
                    </button>
                </div>

                <!-- Coverage Tab Content -->
                <div id="${overviewTabId}" class="coverage-tab-content">
                    ${this.createCoverageOverview(summary)}
                </div>
                <div id="${tealiumTabId}" class="coverage-tab-content hidden">
                    ${this.createTealiumGapAnalysis(tealiumCoverage, summary)}
                </div>
                <div id="${gtmTabId}" class="coverage-tab-content hidden">
                    ${this.createGTMGapAnalysis(gtmCoverage, summary)}
                </div>
            </div>
        `;
        
        resultsContent.appendChild(coverageAnalysis);
    }

    createCoverageOverview(summary) {
        const tealiumCoverage = summary.tealium_coverage || {};
        const gtmCoverage = summary.gtm_coverage || {};
        
        return `
            <div class="space-y-4">
                <!-- Coverage Metrics Grid -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="text-center p-3 bg-white dark:bg-orange-900/30 rounded border">
                        <div class="text-2xl font-bold text-orange-600">${summary.coverage_percentage || 0}%</div>
                        <div class="text-sm text-orange-600 dark:text-orange-400">Overall Coverage</div>
                        <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">Any tag present</div>
                    </div>
                    <div class="text-center p-3 bg-white dark:bg-orange-900/30 rounded border">
                        <div class="text-2xl font-bold text-blue-600">${tealiumCoverage.coverage_percentage || 0}%</div>
                        <div class="text-sm text-orange-600 dark:text-orange-400">Tealium Coverage</div>
                        <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">${tealiumCoverage.pages_with_tealium || 0} of ${summary.successful_scans || 0} pages</div>
                    </div>
                    <div class="text-center p-3 bg-white dark:bg-orange-900/30 rounded border">
                        <div class="text-2xl font-bold text-yellow-600">${gtmCoverage.coverage_percentage || 0}%</div>
                        <div class="text-sm text-orange-600 dark:text-orange-400">GTM Coverage</div>
                        <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">${gtmCoverage.pages_with_gtm || 0} of ${summary.successful_scans || 0} pages</div>
                    </div>
                </div>

                <!-- Visual Coverage Comparison -->
                <div class="space-y-3">
                    <div>
                        <div class="flex justify-between text-sm text-orange-700 dark:text-orange-300 mb-1">
                            <span>Tealium Implementation</span>
                            <span>${tealiumCoverage.coverage_percentage || 0}%</span>
                        </div>
                        <div class="w-full bg-orange-200 dark:bg-orange-800 rounded-full h-2">
                            <div class="bg-blue-600 h-2 rounded-full transition-all" style="width: ${tealiumCoverage.coverage_percentage || 0}%"></div>
                        </div>
                    </div>
                    <div>
                        <div class="flex justify-between text-sm text-orange-700 dark:text-orange-300 mb-1">
                            <span>GTM Implementation</span>
                            <span>${gtmCoverage.coverage_percentage || 0}%</span>
                        </div>
                        <div class="w-full bg-orange-200 dark:bg-orange-800 rounded-full h-2">
                            <div class="bg-yellow-600 h-2 rounded-full transition-all" style="width: ${gtmCoverage.coverage_percentage || 0}%"></div>
                        </div>
                    </div>
                </div>

                <!-- Quick Summary -->
                <div class="bg-orange-100 dark:bg-orange-900/40 p-3 rounded border border-orange-300 dark:border-orange-700 text-sm">
                    <div class="font-medium text-orange-800 dark:text-orange-200 mb-2">
                        <i class="fas fa-info-circle mr-1"></i>Coverage Summary
                    </div>
                    <div class="text-orange-700 dark:text-orange-300 space-y-1">
                        <div>• <strong>${summary.pages_with_both || 0}</strong> pages have both Tealium and GTM</div>
                        <div>• <strong>${summary.pages_with_tealium || 0}</strong> pages have only Tealium</div>
                        <div>• <strong>${summary.pages_with_gtm || 0}</strong> pages have only GTM</div>
                        <div>• <strong>${summary.pages_with_neither || 0}</strong> pages have no tag management</div>
                    </div>
                </div>
            </div>
        `;
    }

    createTealiumGapAnalysis(tealiumCoverage, summary) {
        const missingPages = tealiumCoverage.missing_pages || [];
        const highPriorityPages = missingPages.filter(page => page.priority === 3);
        const mediumPriorityPages = missingPages.filter(page => page.priority === 2);
        
        return `
            <div class="space-y-4">
                <!-- Tealium Coverage Stats -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div class="text-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-700">
                        <div class="text-2xl font-bold text-blue-600">${tealiumCoverage.coverage_percentage || 0}%</div>
                        <div class="text-sm text-blue-700 dark:text-blue-300">Tealium Coverage</div>
                    </div>
                    <div class="text-center p-3 bg-red-50 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-700">
                        <div class="text-2xl font-bold text-red-600">${tealiumCoverage.pages_without_tealium || 0}</div>
                        <div class="text-sm text-red-700 dark:text-red-300">Pages Missing Tealium</div>
                    </div>
                </div>

                ${highPriorityPages.length > 0 ? `
                <div class="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-700">
                    <div class="font-medium text-red-800 dark:text-red-200 mb-2">
                        <i class="fas fa-exclamation-triangle mr-1"></i>High-Priority Pages Missing Tealium (${highPriorityPages.length})
                    </div>
                    <div class="space-y-1 max-h-40 overflow-y-auto">
                        ${highPriorityPages.slice(0, 15).map(page => `
                            <div class="text-sm text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 p-2 rounded flex items-center justify-between">
                                <div class="flex items-center">
                                    <i class="fas fa-link mr-2"></i>
                                    <a href="${page.url}" target="_blank" class="hover:underline">${page.url}</a>
                                </div>
                                <span class="text-xs bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded">Depth ${page.depth}</span>
                            </div>
                        `).join('')}
                        ${highPriorityPages.length > 15 ? `
                            <div class="text-xs text-red-600 dark:text-red-400 italic text-center p-2">
                                ... and ${highPriorityPages.length - 15} more high-priority pages
                            </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}

                ${mediumPriorityPages.length > 0 ? `
                <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-700">
                    <div class="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                        <i class="fas fa-info-circle mr-1"></i>Medium-Priority Pages Missing Tealium (${mediumPriorityPages.length})
                    </div>
                    <div class="space-y-1 max-h-32 overflow-y-auto">
                        ${mediumPriorityPages.slice(0, 10).map(page => `
                            <div class="text-sm text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded flex items-center justify-between">
                                <div class="flex items-center">
                                    <i class="fas fa-link mr-2"></i>
                                    <a href="${page.url}" target="_blank" class="hover:underline">${page.url}</a>
                                </div>
                                <span class="text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">Depth ${page.depth}</span>
                            </div>
                        `).join('')}
                        ${mediumPriorityPages.length > 10 ? `
                            <div class="text-xs text-yellow-600 dark:text-yellow-400 italic text-center p-2">
                                ... and ${mediumPriorityPages.length - 10} more medium-priority pages
                            </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}

                <!-- Tealium Recommendations -->
                <div class="bg-blue-100 dark:bg-blue-900/30 p-3 rounded border border-blue-300 dark:border-blue-700">
                    <div class="font-medium text-blue-800 dark:text-blue-200 mb-2">
                        <i class="fas fa-lightbulb mr-1"></i>Tealium Implementation Recommendations
                    </div>
                    <ul class="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                        <li>• Deploy AdTaxi Tealium tags to ${tealiumCoverage.pages_without_tealium || 0} missing pages</li>
                        ${highPriorityPages.length > 0 ? `<li>• <strong>Priority 1:</strong> Start with ${highPriorityPages.length} high-priority pages (homepage, checkout, contact)</li>` : ''}
                        ${mediumPriorityPages.length > 0 ? `<li>• <strong>Priority 2:</strong> Continue with ${mediumPriorityPages.length} medium-priority pages (blog, support)</li>` : ''}
                        <li>• Use template-based deployment for consistent implementation across all pages</li>
                        <li>• Test Tealium data layer functionality on each page type before going live</li>
                    </ul>
                </div>
            </div>
        `;
    }

    createGTMGapAnalysis(gtmCoverage, summary) {
        const missingPages = gtmCoverage.missing_pages || [];
        const highPriorityPages = missingPages.filter(page => page.priority === 3);
        const mediumPriorityPages = missingPages.filter(page => page.priority === 2);
        
        return `
            <div class="space-y-4">
                <!-- GTM Coverage Stats -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div class="text-center p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded border border-yellow-200 dark:border-yellow-700">
                        <div class="text-2xl font-bold text-yellow-600">${gtmCoverage.coverage_percentage || 0}%</div>
                        <div class="text-sm text-yellow-700 dark:text-yellow-300">GTM Coverage</div>
                    </div>
                    <div class="text-center p-3 bg-red-50 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-700">
                        <div class="text-2xl font-bold text-red-600">${gtmCoverage.pages_without_gtm || 0}</div>
                        <div class="text-sm text-red-700 dark:text-red-300">Pages Missing GTM</div>
                    </div>
                </div>

                ${highPriorityPages.length > 0 ? `
                <div class="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-700">
                    <div class="font-medium text-red-800 dark:text-red-200 mb-2">
                        <i class="fas fa-exclamation-triangle mr-1"></i>High-Priority Pages Missing GTM (${highPriorityPages.length})
                    </div>
                    <div class="space-y-1 max-h-40 overflow-y-auto">
                        ${highPriorityPages.slice(0, 15).map(page => `
                            <div class="text-sm text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 p-2 rounded flex items-center justify-between">
                                <div class="flex items-center">
                                    <i class="fas fa-link mr-2"></i>
                                    <a href="${page.url}" target="_blank" class="hover:underline">${page.url}</a>
                                </div>
                                <span class="text-xs bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded">Depth ${page.depth}</span>
                            </div>
                        `).join('')}
                        ${highPriorityPages.length > 15 ? `
                            <div class="text-xs text-red-600 dark:text-red-400 italic text-center p-2">
                                ... and ${highPriorityPages.length - 15} more high-priority pages
                            </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}

                ${mediumPriorityPages.length > 0 ? `
                <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-700">
                    <div class="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                        <i class="fas fa-info-circle mr-1"></i>Medium-Priority Pages Missing GTM (${mediumPriorityPages.length})
                    </div>
                    <div class="space-y-1 max-h-32 overflow-y-auto">
                        ${mediumPriorityPages.slice(0, 10).map(page => `
                            <div class="text-sm text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded flex items-center justify-between">
                                <div class="flex items-center">
                                    <i class="fas fa-link mr-2"></i>
                                    <a href="${page.url}" target="_blank" class="hover:underline">${page.url}</a>
                                </div>
                                <span class="text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">Depth ${page.depth}</span>
                            </div>
                        `).join('')}
                        ${mediumPriorityPages.length > 10 ? `
                            <div class="text-xs text-yellow-600 dark:text-yellow-400 italic text-center p-2">
                                ... and ${mediumPriorityPages.length - 10} more medium-priority pages
                            </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}

                <!-- GTM Migration Recommendations -->
                <div class="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded border border-yellow-300 dark:border-yellow-700">
                    <div class="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                        <i class="fas fa-lightbulb mr-1"></i>GTM Migration Recommendations
                    </div>
                    <ul class="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                        <li>• Consider migrating from GTM to Tealium for unified AdTaxi tag management</li>
                        ${gtmCoverage.pages_without_gtm > 0 ? `<li>• ${gtmCoverage.pages_without_gtm} pages are missing GTM - perfect opportunity to deploy Tealium instead</li>` : ''}
                        ${highPriorityPages.length > 0 ? `<li>• <strong>Focus areas:</strong> ${highPriorityPages.length} high-priority pages need attention</li>` : ''}
                        <li>• Plan systematic GTM → Tealium migration to avoid tracking gaps</li>
                        <li>• Test parallel implementation before removing GTM containers</li>
                    </ul>
                </div>
            </div>
        `;
    }

    displayResults(results) {
        const resultsContainer = document.getElementById('results');
        const resultsContent = document.getElementById('results-content');
        
        resultsContent.innerHTML = '';

        // Summary stats
        const total = results.length;
        const successful = results.filter(r => r.success).length;
        const matches = results.filter(r => r.matches).length;
        const found = results.filter(r => r.found).length;
        const errors = results.filter(r => !r.success).length;

        // Summary section
        const summary = document.createElement('div');
        summary.className = 'mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg';
        summary.innerHTML = `
            <h4 class="font-semibold text-gray-800 dark:text-gray-200 mb-2">Scan Summary</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div class="text-center">
                    <div class="text-2xl font-bold text-blue-600">${total}</div>
                    <div class="text-gray-600 dark:text-gray-400">Total</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-600">${matches}</div>
                    <div class="text-gray-600 dark:text-gray-400">Correct Account</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-yellow-600">${found - matches}</div>
                    <div class="text-gray-600 dark:text-gray-400">Other Tealium</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-red-600">${errors}</div>
                    <div class="text-gray-600 dark:text-gray-400">Errors</div>
                </div>
            </div>
        `;
        resultsContent.appendChild(summary);

        // Individual results
        results.forEach(result => {
            const resultCard = this.createResultCard(result);
            resultsContent.appendChild(resultCard);
        });

        resultsContainer.classList.remove('hidden');
    }

    createResultCard(result) {
        const card = document.createElement('div');
        card.className = 'mb-4 p-4 border rounded-lg bg-white dark:bg-gray-800';
        
        let statusClass = 'border-gray-200 dark:border-gray-600';
        let statusIcon = 'fas fa-question-circle text-gray-500';
        let statusText = 'Unknown';
        let detailsHtml = '';

        // Prioritize showing Tealium detection results even if there are parsing errors
        if (!result.success && !result.found) {
            statusClass = 'border-red-300 bg-red-50';
            statusIcon = 'fas fa-exclamation-triangle text-red-600';
            statusText = result.summary || `Error: ${result.error}`;
            
            // Add verbose error details if available
            if (result.verboseError) {
                const lines = result.verboseError.split('\n');
                let formattedContent = '';
                let inList = false;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    
                    if (line.startsWith('•')) {
                        if (!inList) {
                            formattedContent += '<ul class="list-disc ml-4 mt-2">';
                            inList = true;
                        }
                        formattedContent += `<li class="mb-1">${line.substring(1).trim()}</li>`;
                    } else if (line === '') {
                        if (inList) {
                            formattedContent += '</ul>';
                            inList = false;
                        }
                        formattedContent += '<div class="mt-2"></div>';
                    } else if (line) {
                        if (inList) {
                            formattedContent += '</ul>';
                            inList = false;
                        }
                        if (line.includes('Suggestions:')) {
                            formattedContent += `<div class="mt-3 font-semibold text-red-800 dark:text-red-200">${line}</div>`;
                        } else {
                            formattedContent += `<div class="mt-2">${line}</div>`;
                        }
                    }
                }
                
                if (inList) {
                    formattedContent += '</ul>';
                }
                
                detailsHtml = `
                    <div class="mt-3 text-sm text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 p-4 rounded-lg">
                        <div class="flex items-start">
                            <i class="fas fa-info-circle text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0"></i>
                            <div class="flex-1">
                                <div class="font-semibold mb-2 text-red-900 dark:text-red-200">Troubleshooting Information:</div>
                                ${formattedContent}
                            </div>
                        </div>
                    </div>
                `;
            }
        } else if (result.matches) {
            statusClass = 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/10';
            statusIcon = 'fas fa-check-circle text-green-600 dark:text-green-400';
            statusText = result.summary;
        } else if (!result.success && result.found) {
            // Tealium found but with parsing errors - still show as success with warning
            statusClass = 'border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/10';
            statusIcon = 'fas fa-check-circle text-yellow-600 dark:text-yellow-400';
            statusText = result.summary + ' (with parsing errors)';
        } else if (result.found) {
            statusClass = 'border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/10';
            statusIcon = 'fas fa-exclamation-circle text-yellow-600 dark:text-yellow-400';
            statusText = result.summary;
        } else {
            statusClass = 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50';
            statusIcon = 'fas fa-times-circle text-gray-500 dark:text-gray-400';
            statusText = result.summary;
        }

        card.className += ` ${statusClass}`;

        // Don't reset detailsHtml if it was already set for errors
        // Show details if Tealium was found, regardless of parsing success
        if (!detailsHtml && result.found) {
            detailsHtml = `
                <div class="mt-3 text-sm text-gray-700 dark:text-gray-300">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div><strong class="text-gray-900 dark:text-gray-100">Account:</strong> ${result.details.account || 'N/A'}</div>
                        <div><strong class="text-gray-900 dark:text-gray-100">Profile:</strong> ${result.details.profile || 'N/A'}</div>
                        <div><strong class="text-gray-900 dark:text-gray-100">Environment:</strong> ${result.details.environment || 'N/A'}</div>
                    </div>
                    ${result.details.tealium_version || result.details.utag_major_version ? `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        ${result.details.tealium_version ? `<div><strong class="text-gray-900 dark:text-gray-100">Tealium Version:</strong> <span class="text-purple-600 dark:text-purple-400">${result.details.tealium_version}</span></div>` : ''}
                        ${result.details.utag_major_version ? `<div><strong class="text-gray-900 dark:text-gray-100">Utag Version:</strong> <span class="text-purple-600 dark:text-purple-400">v${result.details.utag_major_version}.${result.details.utag_minor_version || '0'}</span></div>` : ''}
                    </div>
                    ` : ''}
                    ${result.details.profile_build_date || result.details.build_version || result.details.publish_date ? `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs text-gray-600 dark:text-gray-400">
                        ${result.details.profile_build_date ? `<div><strong class="text-gray-800 dark:text-gray-300">Profile Build:</strong> ${result.details.profile_build_date}</div>` : ''}
                        ${result.details.build_version ? `<div><strong class="text-gray-800 dark:text-gray-300">Build:</strong> ${result.details.build_version}</div>` : ''}
                        ${result.details.publish_date ? `<div><strong class="text-gray-800 dark:text-gray-300">Published:</strong> ${result.details.publish_date}</div>` : ''}
                    </div>
                    ` : ''}
                    <div class="mt-2">
                        <strong class="text-gray-900 dark:text-gray-100">Scripts found:</strong> ${result.scripts?.length || 0}
                    </div>
                </div>
            `;
        }

        // Add parsing error notice for successful Tealium detection with parsing issues
        if (!result.success && result.found && result.error && !detailsHtml.includes('Troubleshooting Information')) {
            detailsHtml += `
                <div class="mt-3 text-sm text-yellow-800 dark:text-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/50 p-3 rounded-lg">
                    <div class="flex items-start">
                        <i class="fas fa-info-circle text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5 flex-shrink-0"></i>
                        <div class="flex-1">
                            <div class="font-semibold mb-1 text-yellow-900 dark:text-yellow-200">Note:</div>
                            <div class="text-sm">Tealium was detected successfully, but there were minor parsing errors: ${result.error}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <div class="flex items-center mb-2">
                        <i class="${statusIcon} mr-2"></i>
                        <span class="font-medium text-gray-800 dark:text-gray-200">${result.url}</span>
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">${statusText}</div>
                    ${this.createTabbedResults(result, detailsHtml)}
                </div>
                <div class="text-xs text-gray-400 dark:text-gray-500 ml-4">
                    ${new Date(result.timestamp).toLocaleString()}
                </div>
            </div>
        `;

        return card;
    }

    createTabbedResults(result, tealiumDetailsHtml) {
        const randomId = Math.random().toString(36).substr(2, 9);
        const tealiumTabId = `tealium-${randomId}`;
        const gtmTabId = `gtm-${randomId}`;
        const relationshipTabId = `relationship-${randomId}`;

        // Determine if we have results to show
        const hasTealiumResults = result.found || (result.success && tealiumDetailsHtml);
        const hasGtmResults = result.gtm && (result.gtm.found || result.gtm.summary);
        const hasRelationshipResults = result.relationship && result.relationship.status !== 'none';
        
        console.log('🎨 Creating tabbed results UI...');
        console.log('   📊 Result analysis:');
        console.log('      • result.success:', result.success);
        console.log('      • result.found (Tealium):', result.found);
        console.log('      • result.gtm?.found:', result.gtm?.found);
        console.log('      • result.relationship?.status:', result.relationship?.status);
        console.log('      • hasTealiumResults:', hasTealiumResults);
        console.log('      • hasGtmResults:', hasGtmResults);
        console.log('      • hasRelationshipResults:', hasRelationshipResults);
        
        // Always show tabs if we have any results OR if this is a successful scan
        // This ensures all types of results are displayed properly
        if (!hasTealiumResults && !hasGtmResults && !hasRelationshipResults && !result.success) {
            console.log('   ⚪ Using simple view - no results found and scan failed');
            return tealiumDetailsHtml; // Only return simple view if scan failed completely
        }

        console.log('   ✅ Using tabbed interface');
        console.log('   🏷️ Tab IDs:', { tealiumTabId, gtmTabId, relationshipTabId });

        // Create GTM details
        const gtmDetailsHtml = this.createGTMDetails(result);
        
        // Create relationship details
        const relationshipDetailsHtml = this.createRelationshipDetails(result);

        return `
            <div class="mt-4">
                <!-- Tab Navigation -->
                <div class="flex border-b border-gray-200 dark:border-gray-600 mb-3">
                    <button 
                        class="tab-button px-4 py-2 text-sm font-medium border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none transition-colors" 
                        onclick="switchTab('${tealiumTabId}', '${gtmTabId},${relationshipTabId}', this)"
                        data-active-class="border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    >
                        <i class="fas fa-tag mr-1"></i>Tealium
                        ${result.found ? '<span class="ml-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-1 rounded">✓</span>' : ''}
                    </button>
                    <button 
                        class="tab-button px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none transition-colors" 
                        onclick="switchTab('${gtmTabId}', '${tealiumTabId},${relationshipTabId}', this)"
                        data-active-class="border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    >
                        <i class="fab fa-google mr-1"></i>GTM
                        ${result.gtm && result.gtm.found ? '<span class="ml-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-1 rounded">✓</span>' : ''}
                    </button>
                    <button 
                        class="tab-button px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none transition-colors" 
                        onclick="switchTab('${relationshipTabId}', '${tealiumTabId},${gtmTabId}', this)"
                        data-active-class="border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    >
                        <i class="fas fa-link mr-1"></i>Relationship
                        ${hasRelationshipResults ? this.getRelationshipStatusBadge(result.relationship.status) : ''}
                    </button>
                </div>

                <!-- Tab Content -->
                <div id="${tealiumTabId}" class="tab-content">
                    ${hasTealiumResults ? tealiumDetailsHtml : '<div class="text-sm text-gray-500 dark:text-gray-400 italic">No Tealium implementation detected</div>'}
                </div>
                <div id="${gtmTabId}" class="tab-content hidden">
                    ${hasGtmResults ? gtmDetailsHtml : '<div class="text-sm text-gray-500 dark:text-gray-400 italic">No GTM containers detected</div>'}
                </div>
                <div id="${relationshipTabId}" class="tab-content hidden">
                    ${hasRelationshipResults ? relationshipDetailsHtml : '<div class="text-sm text-gray-500 dark:text-gray-400 italic">No tag management relationships detected</div>'}
                </div>
            </div>
        `;
    }

    createGTMDetails(result) {
        if (!result.gtm || (!result.gtm.found && !result.gtm.summary)) {
            return '<div class="text-sm text-gray-500 dark:text-gray-400 italic">No GTM containers detected</div>';
        }

        let gtmStatusClass = '';
        let gtmStatusIcon = '';
        let gtmDetailsHtml = '';

        // Determine GTM status styling
        if (result.gtm.found) {
            if (result.gtm.matches) {
                gtmStatusClass = 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/10';
                gtmStatusIcon = 'fas fa-check-circle text-green-600 dark:text-green-400';
            } else {
                gtmStatusClass = 'border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/10';
                gtmStatusIcon = 'fas fa-exclamation-circle text-yellow-600 dark:text-yellow-400';
            }

            // Create details for found containers
            const containerTypes = result.gtm.details.container_types || { gtm: [], ga4: [], other: [] };
            const containersList = [];

            if (containerTypes && containerTypes.gtm && containerTypes.gtm.length > 0) {
                containersList.push(`<div><strong class="text-gray-900 dark:text-gray-100">GTM Containers:</strong> ${containerTypes.gtm.join(', ')}</div>`);
            }
            if (containerTypes && containerTypes.ga4 && containerTypes.ga4.length > 0) {
                containersList.push(`<div><strong class="text-gray-900 dark:text-gray-100">GA4 Properties:</strong> ${containerTypes.ga4.join(', ')}</div>`);
            }
            if (containerTypes && containerTypes.other && containerTypes.other.length > 0) {
                containersList.push(`<div><strong class="text-gray-900 dark:text-gray-100">Other:</strong> ${containerTypes.other.join(', ')}</div>`);
            }

            gtmDetailsHtml = `
                <div class="text-sm text-gray-700 dark:text-gray-300 mt-3">
                    <div class="grid grid-cols-1 gap-2">
                        ${containersList.join('')}
                        <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <strong class="text-gray-900 dark:text-gray-100">Total Containers:</strong> ${result.gtm.details.total_containers || 0}
                        </div>
                    </div>
                </div>
            `;
        } else {
            gtmStatusClass = 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50';
            gtmStatusIcon = 'fas fa-times-circle text-gray-500 dark:text-gray-400';
        }

        return `
            <div class="p-3 border ${gtmStatusClass} rounded-lg">
                <div class="flex items-center mb-2">
                    <i class="${gtmStatusIcon} mr-2"></i>
                    <span class="font-medium text-gray-800 dark:text-gray-200 text-sm">${result.gtm.summary}</span>
                </div>
                ${gtmDetailsHtml}
            </div>
        `;
    }

    getRelationshipStatusBadge(status) {
        const badges = {
            'none': '',
            'tealium_only': '<span class="ml-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-1 rounded">Clean</span>',
            'gtm_only': '<span class="ml-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 px-1 rounded">GTM</span>',
            'both_present': '<span class="ml-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-1 rounded">Both</span>',
            'conflicting': '<span class="ml-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 px-1 rounded">⚠</span>',
            'complementary': '<span class="ml-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 px-1 rounded">Migration</span>'
        };
        return badges[status] || '';
    }

    createRelationshipDetails(result) {
        if (!result.relationship || result.relationship.status === 'none') {
            return '<div class="text-sm text-gray-500 dark:text-gray-400 italic">No tag management relationships detected</div>';
        }

        const relationship = result.relationship;
        let statusClass = '';
        let statusIcon = '';
        
        // Determine status styling - updated for Tag Placement Methodology
        switch (relationship.methodology) {
            case 'tealium_managed':
                statusClass = 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/10';
                statusIcon = 'fas fa-check-circle text-green-600 dark:text-green-400';
                break;
            case 'gtm_managed':
                statusClass = 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/10';
                statusIcon = 'fab fa-google text-blue-600 dark:text-blue-400';
                break;
            case 'dual_tag_managers':
                statusClass = 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/10';
                statusIcon = 'fas fa-exchange-alt text-purple-600 dark:text-purple-400';
                break;
            case 'no_tag_management':
                statusClass = 'border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/10';
                statusIcon = 'fas fa-exclamation-triangle text-yellow-600 dark:text-yellow-400';
                break;
            default:
                statusClass = 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50';
                statusIcon = 'fas fa-question-circle text-gray-500 dark:text-gray-400';
        }

        let detailsHtml = `
            <div class="p-3 border ${statusClass} rounded-lg">
                <div class="flex items-center mb-2">
                    <i class="${statusIcon} mr-2"></i>
                    <span class="font-medium text-gray-800 dark:text-gray-200 text-sm">${relationship.analysis}</span>
                </div>
                
                <div class="text-sm text-gray-700 dark:text-gray-300 mt-3">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div><strong class="text-gray-900 dark:text-gray-100">Methodology:</strong> ${this.formatMethodology(relationship.methodology)}</div>
                        <div><strong class="text-gray-900 dark:text-gray-100">Tag Managers:</strong> ${relationship.patterns?.tag_manager_placement?.length || 0}</div>
                    </div>
                </div>
        `;

        // Add recommendations if any
        if (relationship.recommendations && relationship.recommendations.length > 0) {
            detailsHtml += `
                <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div class="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
                        <i class="fas fa-lightbulb text-yellow-500 mr-1"></i>Recommendations:
                    </div>
                    <ul class="list-disc ml-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        ${relationship.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // Add Tag Manager details if any
        if (relationship.patterns?.tag_manager_placement && relationship.patterns.tag_manager_placement.length > 0) {
            detailsHtml += `
                <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div class="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
                        <i class="fas fa-cogs text-blue-500 mr-1"></i>Tag Management Systems:
                    </div>
                    <div class="space-y-2">
                        ${relationship.patterns.tag_manager_placement.map(tm => `
                            <div class="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded text-sm">
                                <div class="font-medium text-blue-800 dark:text-blue-200">${tm.system}</div>
                                <div class="text-blue-700 dark:text-blue-300 text-xs mt-1">
                                    ${tm.system === 'Tealium' ? `${tm.account}/${tm.profile}/${tm.environment}` : `${tm.containers?.length || 0} container(s)`}
                                    • ${tm.implementation_type} • ${tm.loading_pattern}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Add Direct Tags if any
        if (relationship.patterns?.direct_placement && relationship.patterns.direct_placement.length > 0) {
            detailsHtml += `
                <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div class="font-semibold text-orange-900 dark:text-orange-100 text-sm mb-2">
                        <i class="fas fa-code text-orange-500 mr-1"></i>Direct Tag Implementations:
                    </div>
                    <div class="space-y-2">
                        ${relationship.patterns.direct_placement.map(tag => `
                            <div class="p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded text-sm">
                                <div class="font-medium text-orange-800 dark:text-orange-200">${tag.name}</div>
                                <div class="text-orange-700 dark:text-orange-300 text-xs mt-1">${tag.placement} • ${tag.loading_pattern}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Add Nested Implementations if any
        if (relationship.patterns?.nested_placement && relationship.patterns.nested_placement.length > 0) {
            detailsHtml += `
                <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div class="font-semibold text-purple-900 dark:text-purple-100 text-sm mb-2">
                        <i class="fas fa-layer-group text-purple-500 mr-1"></i>Nested Implementations:
                    </div>
                    <div class="space-y-2">
                        ${relationship.patterns.nested_placement.map(nested => `
                            <div class="p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded text-sm">
                                <div class="font-medium text-purple-800 dark:text-purple-200">${nested.type}</div>
                                <div class="text-purple-700 dark:text-purple-300 text-xs mt-1">${nested.description}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        detailsHtml += '</div>';
        return detailsHtml;
    }

    formatMethodology(methodology) {
        const methodologyMap = {
            'no_tag_management': 'No Tag Management',
            'tealium_managed': 'Tealium Managed',
            'gtm_managed': 'GTM Managed',
            'dual_tag_managers': 'Multiple Tag Managers'
        };
        return methodologyMap[methodology] || methodology;
    }

    formatStatus(status) {
        const statusMap = {
            'none': 'No tags detected',
            'tealium_only': 'Tealium only (Clean)',
            'gtm_only': 'GTM only',
            'both_present': 'Both systems active',
            'conflicting': 'Conflicting implementations',
            'complementary': 'Migration in progress'
        };
        return statusMap[status] || status;
    }

    formatMigrationStatus(status) {
        const statusMap = {
            'unknown': 'Unknown',
            'not_started': 'Not started',
            'in_progress': 'In progress',
            'complete': 'Complete',
            'rollback': 'Rollback detected'
        };
        return statusMap[status] || status;
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('results').classList.add('hidden');
        document.getElementById('check-single').disabled = true;
        document.getElementById('check-multiple').disabled = true;
        document.getElementById('crawl-site').disabled = true;
        document.getElementById('analyze-site').disabled = true;
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('check-single').disabled = false;
        document.getElementById('check-multiple').disabled = false;
        document.getElementById('crawl-site').disabled = false;
        document.getElementById('analyze-site').disabled = false;
    }

    showError(message) {
        const resultsContainer = document.getElementById('results');
        const resultsContent = document.getElementById('results-content');
        
        resultsContent.innerHTML = `
            <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-600 rounded-lg">
                <div class="flex items-center">
                    <i class="fas fa-exclamation-triangle text-red-600 mr-2"></i>
                    <span class="text-red-800 dark:text-red-200 font-medium">Error</span>
                </div>
                <div class="mt-2 text-red-700 dark:text-red-300">${message}</div>
            </div>
        `;
        
        resultsContainer.classList.remove('hidden');
    }
}

// Tab switching function - needs to be global for onclick handlers
function switchTab(activeTabId, inactiveTabIds, clickedButton) {
    console.log('🔄 Switching tabs...');
    console.log('   📍 Active tab:', activeTabId);
    console.log('   📍 Inactive tabs:', inactiveTabIds);
    console.log('   🖱️ Clicked button:', clickedButton.textContent.trim());

    // Hide all inactive tab content (support comma-separated list)
    const inactiveTabIdList = inactiveTabIds.split(',');
    inactiveTabIdList.forEach(tabId => {
        const inactiveTab = document.getElementById(tabId.trim());
        if (inactiveTab) {
            inactiveTab.classList.add('hidden');
            console.log(`   ✅ Hidden inactive tab: ${tabId.trim()}`);
        } else {
            console.log(`   ⚠️ Inactive tab element not found: ${tabId.trim()}`);
        }
    });
    
    // Show active tab content
    const activeTab = document.getElementById(activeTabId);
    if (activeTab) {
        activeTab.classList.remove('hidden');
        console.log('   ✅ Showed active tab');
    } else {
        console.log('   ⚠️ Active tab element not found');
    }
    
    // Update button styles - find parent container and update all buttons
    const container = clickedButton.parentElement;
    const allButtons = container.querySelectorAll('.tab-button');
    
    console.log('   🎨 Updating button styles for', allButtons.length, 'buttons');
    
    allButtons.forEach((button, index) => {
        console.log(`      Button ${index + 1}: "${button.textContent.trim()}"`);
        // Remove active classes
        button.classList.remove('border-blue-600', 'text-blue-600', 'dark:border-blue-400', 'dark:text-blue-400');
        button.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
    });
    
    // Add active classes to clicked button
    clickedButton.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
    clickedButton.classList.add('border-blue-600', 'text-blue-600', 'dark:border-blue-400', 'dark:text-blue-400');
    console.log('   ✅ Tab switch complete');
}

// Coverage tab switching function - needs to be global for onclick handlers
function switchCoverageTab(activeTabId, inactiveTabIds, clickedButton) {
    console.log('🔄 Switching coverage tabs...');
    console.log('   📍 Active tab:', activeTabId);
    console.log('   📍 Inactive tabs:', inactiveTabIds);

    // Hide all inactive tab content (support comma-separated list)
    const inactiveTabIdList = inactiveTabIds.split(',');
    inactiveTabIdList.forEach(tabId => {
        const inactiveTab = document.getElementById(tabId.trim());
        if (inactiveTab) {
            inactiveTab.classList.add('hidden');
            console.log(`   ✅ Hidden inactive coverage tab: ${tabId.trim()}`);
        }
    });
    
    // Show active tab content
    const activeTab = document.getElementById(activeTabId);
    if (activeTab) {
        activeTab.classList.remove('hidden');
        console.log('   ✅ Showed active coverage tab');
    }
    
    // Update button styles - find parent container and update all buttons
    const container = clickedButton.parentElement;
    const allButtons = container.querySelectorAll('.coverage-tab-button');
    
    console.log('   🎨 Updating coverage button styles for', allButtons.length, 'buttons');
    
    allButtons.forEach((button, index) => {
        // Remove active classes
        button.classList.remove('border-orange-600', 'text-orange-600', 'dark:border-orange-400', 'dark:text-orange-400');
        button.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
    });
    
    // Add active classes to clicked button
    clickedButton.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
    clickedButton.classList.add('border-orange-600', 'text-orange-600', 'dark:border-orange-400', 'dark:text-orange-400');
    console.log('   ✅ Coverage tab switch complete');
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TealiumChecker();
});