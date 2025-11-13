// Chart configuration constants
const CONFIG = {
    width: 800,
    height: 500,
    margin: { top: 40, right: 40, bottom: 60, left: 60 },
    columnMapping: {
        fraudFlag: 'fraud_combined',
        sessionId: 'sessionid'
    }
};

// Global App instance
class App {
    constructor() {
        this.datasets = [];
        this.chartManager = new ChartManager(CONFIG);
        this.dataProcessor = new DataProcessor(CONFIG.columnMapping);
        this.exportManager = new ExportManager();
        this.mergeManager = new MergeManager();
        
        
        this.chartManager.app = this;
        this.resizeObserver = null;
    }

    init() {
        this.setupEventListeners();
        this.setupResponsiveObserver();
        console.log('Application initialized with responsive improvements');
    }

    setupEventListeners() {
        const fileUpload = document.getElementById('file-upload');
        const addChart = document.getElementById('add-chart');
        const exportCharts = document.getElementById('export-charts');
        const joinCharts = document.getElementById('join-charts');

        if (fileUpload) {
            fileUpload.addEventListener('change', (e) => this.handleFileUpload(e));
        } else {
            console.error('File upload element not found');
        }

        if (addChart) {
            addChart.addEventListener('click', () => this.addNewChart());
        }

        if (exportCharts) {
            exportCharts.addEventListener('click', () => this.showExportModal());
        }

        if (joinCharts) {
            joinCharts.addEventListener('click', () => this.showJoinModal());
        }
    }

    
    setupResponsiveObserver() {
        
        if (typeof ResizeObserver === 'undefined') {
            console.warn('ResizeObserver not supported, using window resize');
            window.addEventListener('resize', () => this.handleResize());
            return;
        }

        this.resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                
                setTimeout(() => {
                    this.handleResize();
                }, 100);
            }
        });

        
        const chartsGrid = document.getElementById('charts-grid');
        const controls = document.getElementById('controls');
        
        if (chartsGrid) {
            this.resizeObserver.observe(chartsGrid);
        }
        if (controls) {
            this.resizeObserver.observe(controls);
        }

        console.log('Responsive observer setup complete');
    }

    async handleFileUpload(event) {
        const files = Array.from(event.target.files);
        if (!files.length) return;

        this.showFileMessage(`Processing ${files.length} files...`, 'info');

        try {
            // Clear existing data if it's the first upload
            if (this.datasets.length === 0) {
                const chartsGrid = document.getElementById('charts-grid');
                if (chartsGrid) {
                    chartsGrid.innerHTML = '';
                }
                this.chartManager.charts = [];
            }

            for (const file of files) {
                try {
                    console.log('Processing file:', file.name);
                    const processedData = await this.dataProcessor.processFile(file);
                    
                    if (!processedData?.sampledData?.length) {
                        throw new Error('File contains no valid data');
                    }

                    this.datasets.push({
                        name: file.name,
                        data: processedData.sampledData,
                        variables: processedData.availableVariables,
                        totalRecords: processedData.totalRecords
                    });

                    console.log('File processed successfully. Variables:', processedData.availableVariables);
                    this.updateFileListUI();
                    
                } catch (error) {
                    console.error(`Error processing file ${file.name}:`, error);
                    this.showFileMessage(`Error with ${file.name}: ${error.message}`, 'error');
                }
            }

            this.showFileMessage(`Successfully loaded ${files.length} files`, 'success');
            
            // If this was the first upload, add a default chart
            if (this.datasets.length === files.length && files.length > 0) {
                this.addNewChart();
            }
        } catch (error) {
            console.error('File processing error:', error);
            this.showFileError(error.message || 'File processing error');
        }
    }

    addNewChart() {
        if (this.datasets.length === 0) {
            alert('Please load data first');
            return;
        }

        const chart = this.chartManager.createChart(this.datasets);
        
        
        if (this.resizeObserver && chart) {
            const chartElement = document.getElementById(chart.containerId.replace('chart-', ''));
            if (chartElement) {
                this.resizeObserver.observe(chartElement);
            }
        }
    }

    showExportModal() {
        this.exportManager.showModal(this.chartManager.charts);
    }

    showJoinModal() {
        this.mergeManager.showModal(this.chartManager.charts, this.datasets);
    }

    handleResize() {
        console.log('Handling resize...');
        if (this.chartManager && typeof this.chartManager.handleResize === 'function') {
            this.chartManager.handleResize();
        }
    }

    updateFileListUI() {
        const fileList = document.getElementById('file-list');
        if (!fileList) return;
        
        fileList.innerHTML = '';
        
        this.datasets.forEach((dataset, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span class="file-name">${dataset.name}</span>
                <span class="file-records">${dataset.totalRecords.toLocaleString()} records</span>
                <button class="remove-file" data-index="${index}">×</button>
            `;
            fileList.appendChild(fileItem);
        });

        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-file').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                this.removeDataset(index);
            });
        });
    }

    removeDataset(index) {
        if (index < 0 || index >= this.datasets.length) return;
        
        // Check if any chart is using this dataset
        const chartsUsingDataset = this.chartManager.charts.filter(chart => 
            chart.datasetIndex === index
        );
        
        if (chartsUsingDataset.length > 0) {
            if (!confirm(`This dataset is used by ${chartsUsingDataset.length} chart(s). Remove anyway?`)) {
                return;
            }
            
            // Remove charts using this dataset
            chartsUsingDataset.forEach(chart => {
                this.chartManager.removeChart(chart.containerId);
            });
        }
        
        // Remove the dataset
        this.datasets.splice(index, 1);
        
        // Update UI
        this.updateFileListUI();
        
        // Update dataset indices in all charts
        this.chartManager.charts.forEach(chart => {
            if (chart.datasetIndex > index) {
                chart.datasetIndex--;
            }
        });
    }

    showFileMessage(message, type = 'info') {
        const element = document.getElementById('file-info');
        if (element) {
            element.textContent = message;
            element.style.color = type === 'error' ? 'red' :
                type === 'success' ? 'var(--tu-blue)' :
                'var(--tu-dark-gray)';
        }
    }

    showFileError(message) {
        this.showFileMessage(message, 'error');
    }

    
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - Starting app initialization');
    
    // Wait a brief moment for all scripts to load
    setTimeout(function() {
        if (typeof App !== 'undefined') {
            window.app = new App();
            window.app.init();
            console.log('App initialized successfully with responsive features');
        } else {
            console.error('App class not defined. Available classes:');
            console.log('- DataProcessor:', typeof DataProcessor);
            console.log('- ChartRenderer:', typeof ChartRenderer);
            console.log('- ExportManager:', typeof ExportManager);
            console.log('- MergeManager:', typeof MergeManager);
            console.log('- ChartManager:', typeof ChartManager);
            console.log('- App:', typeof App);
        }
    }, 100);
});

if (typeof ResizeObserver === 'undefined') {
    console.warn('ResizeObserver not available, loading polyfill');
    
    window.ResizeObserver = class ResizeObserver {
        constructor(callback) {
            this.callback = callback;
        }
        observe(target) {
            
            window.addEventListener('resize', this.callback);
        }
        unobserve(target) {
            window.removeEventListener('resize', this.callback);
        }
        disconnect() {
            window.removeEventListener('resize', this.callback);
        }
    };
}