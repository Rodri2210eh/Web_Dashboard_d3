// chart-manager.js
class ChartManager {
    constructor(config) {
        this.config = config;
        this.charts = [];
        this.chartRenderer = new ChartRenderer();
        this.app = null; // Será asignado por main.js
    }

    createChart(datasets) {
        const chartId = `chart-${Date.now()}`;
        const chartsGrid = document.getElementById('charts-grid');
        
        const chartWrapper = this.createChartDOM(chartId);
        chartsGrid.appendChild(chartWrapper);
        
        const chart = this.initializeD3Chart(chartId);
        chart.datasetIndex = 0; // Default to first dataset
        this.charts.push(chart);

        this.setupChartEventListeners(chartId, datasets);
        this.updateColorPickers(chartId); // Initialize color pickers based on default chart type
        this.adjustChartSize(chartId);

        return chart;
    }

    prepareCompareData(chartId, variableName) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart || !this.app || !this.app.datasets || this.app.datasets.length === 0) {
            console.error('No datasets available');
            return null;
        }

        // Use the current dataset (not multiple datasets)
        const currentDataset = this.app.datasets[chart.datasetIndex];

        // Extract values for fraud=1 (positive) and fraud=0 (negative) groups
        const positiveSeries = []; // fraud = 1
        const negativeSeries = []; // fraud = 0

        for (let i = 0; i < currentDataset.data.length; i++) {
            const row = currentDataset.data[i];
            const fraudValue = parseInt(row[this.config.columnMapping.fraudFlag]);
            const variableValue = parseFloat(row[variableName]);

            if (!isNaN(variableValue)) {
                if (fraudValue === 1) {
                    positiveSeries.push(variableValue);
                } else if (fraudValue === 0) {
                    negativeSeries.push(variableValue);
                }
            }
        }

        console.log(`Comparison groups - Positive (fraud=1): ${positiveSeries.length}, Negative (fraud=0): ${negativeSeries.length}`);

        if (positiveSeries.length === 0 || negativeSeries.length === 0) {
            console.error('Not enough data in both fraud groups');
            alert(`Insufficient data: fraud=1 (${positiveSeries.length} records), fraud=0 (${negativeSeries.length} records)`);
            return null;
        }

        // Calculate KS statistic
        const ksResult = this.calculateKSTest(positiveSeries, negativeSeries);

        return {
            series1: positiveSeries,
            series2: negativeSeries,
            name1: 'positive examples (fraud=1)',
            name2: 'negative examples (fraud=0)',
            ksStat: ksResult.statistic,
            pValue: ksResult.pValue,
            variableName: variableName,
            datasetName: currentDataset.name
        };
    }

    extractVariableValues(data, variableName) {
        const values = [];
        for (let i = 0; i < data.length; i++) {
            const val = parseFloat(data[i][variableName]);
            if (!isNaN(val)) {
                values.push(val);
            }
        }
        return values;
    }

    calculateKSTest(series1, series2) {
        // Implementation of Kolmogorov-Smirnov test
        const sorted1 = [...series1].sort((a, b) => a - b);
        const sorted2 = [...series2].sort((a, b) => a - b);
        
        const n1 = sorted1.length;
        const n2 = sorted2.length;
        
        let i = 0, j = 0;
        let d = 0;
        let fn1 = 0, fn2 = 0;
        
        while (i < n1 && j < n2) {
            const x1 = sorted1[i];
            const x2 = sorted2[j];
            
            if (x1 <= x2) {
                fn1 = ++i / n1;
            }
            if (x2 <= x1) {
                fn2 = ++j / n2;
            }
            
            const dist = Math.abs(fn2 - fn1);
            if (dist > d) {
                d = dist;
            }
        }
        
        // Approximate p-value calculation
        const n = (n1 * n2) / (n1 + n2);
        const pValue = this.ksPValue(d, n);
        
        return {
            statistic: d,
            pValue: pValue
        };
    }

    ksPValue(d, n) {
        // Approximation for KS test p-value
        if (d === 0) return 1;
        
        const x = d * Math.sqrt(n) + 0.12 + 0.11 / Math.sqrt(n);
        let pValue = 0;
        
        if (x < 1.18) {
            pValue = 1 - 0.627 * Math.exp(-1.2 * x * x);
        } else {
            pValue = 2 * Math.exp(-2 * x * x);
        }
        
        return Math.max(0, Math.min(1, pValue));
    }

    createChartDOM(chartId) {
        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'chart-wrapper';
        chartWrapper.id = chartId;
        
        const chartHeader = this.createChartHeader(chartId);
        const chartDiv = this.createChartContainer(chartId);
        const tooltip = this.createTooltip(chartId);

        chartWrapper.appendChild(chartHeader);
        chartWrapper.appendChild(chartDiv);
        chartWrapper.appendChild(tooltip);

        return chartWrapper;
    }

    createChartHeader(chartId) {
        const chartHeader = document.createElement('div');
        chartHeader.className = 'chart-header';
        
        const chartTitle = document.createElement('h3');
        chartTitle.className = 'chart-title';
        chartTitle.textContent = 'Analysis: Select a variable';
        
        const chartControls = this.createChartControls(chartId);
        
        chartHeader.appendChild(chartTitle);
        chartHeader.appendChild(chartControls);

        return chartHeader;
    }

    createChartControls(chartId) {
        const chartControls = document.createElement('div');
        chartControls.className = 'chart-controls';

        const controls = [
            this.createDatasetSelect(),
            this.createVariableSelect(),
            this.createBinCountInput(), // Now returns container with label + input
            this.createChartTypeSelect(),
            this.createRemoveButton(chartId)
        ];

        controls.forEach(control => chartControls.appendChild(control));
        return chartControls;
    }

    createDatasetSelect() {
        const select = document.createElement('select');
        select.className = 'chart-dataset-select';
        return select;
    }

    createVariableSelect() {
        const select = document.createElement('select');
        select.className = 'chart-variable-select';
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a variable';
        select.appendChild(defaultOption);
        
        return select;
    }

    createBinCountInput() {
        const container = document.createElement('div');
        container.className = 'bin-control-container';
        
        const label = document.createElement('label');
        label.textContent = 'Bins:';
        label.className = 'bin-count-label';
        
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '3';
        input.max = '20';
        input.value = '10';
        input.className = 'chart-bin-count';
        
        container.appendChild(label);
        container.appendChild(input);
        
        return container;
    }

    createChartTypeSelect() {
        const select = document.createElement('select');
        select.className = 'chart-type-select';
        
        const chartTypes = [
            { value: 'histogram', text: 'Histogram (Bars)' },
            { value: 'line', text: 'Line Chart' },
            { value: 'area', text: 'Area Chart' },
            { value: 'scatter', text: 'Scatter Plot' },
            { value: 'bar-horizontal', text: 'Horizontal Bars' },
            { value: 'smooth-line', text: 'Smooth Line' },
            { value: 'step', text: 'Step Chart' },
            { value: 'dot', text: 'Dot Plot' },
            { value: 'compare-histogram', text: 'Compare Histograms (KS Test)' },
            { value: 'outlier-detection', text: 'Outlier Detection (IQR)' }
        ];
        
        chartTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.value;
            option.textContent = type.text;
            select.appendChild(option);
        });
        
        return select;
    }

    createColorPicker() {
        const container = document.createElement('div');
        container.className = 'color-picker';
        
        const label = document.createElement('span');
        label.className = 'color-picker-label';
        label.textContent = 'Colors:';
        
        const color1Input = document.createElement('input');
        color1Input.type = 'color';
        color1Input.value = '#ff6b6b';
        color1Input.className = 'color-picker-input color-picker-1';
        color1Input.title = 'Color for fraud=1';
        
        const color2Input = document.createElement('input');
        color2Input.type = 'color';
        color2Input.value = '#4ecdc4';
        color2Input.className = 'color-picker-input color-picker-2';
        color2Input.title = 'Color for fraud=0';
        
        container.appendChild(label);
        container.appendChild(color1Input);
        container.appendChild(color2Input);
        
        return container;
    }

    createRemoveButton(chartId) {
        const button = document.createElement('button');
        button.className = 'remove-chart';
        button.textContent = 'Remove';
        button.onclick = () => this.removeChart(chartId);
        return button;
    }

    createChartContainer(chartId) {
        const div = document.createElement('div');
        div.className = 'chart';
        div.id = `chart-${chartId}`;
        return div;
    }

    createTooltip(chartId) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.style.opacity = '0';
        tooltip.id = `tooltip-${chartId}`;
        return tooltip;
    }

    initializeD3Chart(containerId) {
        const container = d3.select(`#chart-${containerId}`);
        const containerWidth = container.node().getBoundingClientRect().width;
        const containerHeight = container.node().getBoundingClientRect().height;
        
        const chartWidth = containerWidth - this.config.margin.left - this.config.margin.right;
        const chartHeight = containerHeight - this.config.margin.top - this.config.margin.bottom;

        const svg = container.append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
            .append('g')
            .attr('transform', `translate(${this.config.margin.left},${this.config.margin.top})`);

        const clip = svg.append('defs').append('clipPath')
            .attr('id', `clip-${containerId}`)
            .append('rect')
            .attr('width', chartWidth)
            .attr('height', chartHeight);

        const chartGroup = svg.append('g')
            .attr('clip-path', `url(#clip-${containerId})`);

        const barsGroup = chartGroup.append('g').attr('class', 'bars-group');
        const trendGroup = chartGroup.append('g').attr('class', 'trend-group');
        const hitAreaGroup = svg.append('g').attr('class', 'hit-area-group');
        const axesGroup = svg.append('g').attr('class', 'axes-group');
        
        const xAxis = axesGroup.append('g')
            .attr('class', 'x-axis axis')
            .attr('transform', `translate(0,${chartHeight})`);
            
        const yAxis = axesGroup.append('g').attr('class', 'y-axis axis');
        
        // Initialize brush but don't attach events yet - they will be conditionally set
        const brushGroup = svg.append('g').attr('class', 'brush-group');
        const brush = d3.brushX()
            .extent([[0, 0], [chartWidth, chartHeight]]);

        // Double-click event will be conditionally handled
        svg.on('dblclick', () => {}); // Empty handler for now

        return {
            containerId: `chart-${containerId}`,
            svg,
            chartGroup,
            barsGroup,
            trendGroup,
            hitAreaGroup,
            axesGroup,
            xAxis,
            yAxis,
            brushGroup,
            brush,
            xScale: d3.scaleLinear().range([0, chartWidth]),
            yScale: d3.scaleLinear().range([chartHeight, 0]),
            currentBins: [],
            currentRegression: null,
            isZoomed: false,
            width: chartWidth,
            height: chartHeight,
            datasetIndex: 0
        };
    }

    setupChartZoom(chartId, chartType) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart) return;

        const isComparisonChart = chartType === 'compare-histogram' || chartType === 'outlier-detection';

        // Remove existing brush
        chart.brushGroup.selectAll('*').remove();

        if (!isComparisonChart) {
            // Enable zoom for non-comparison charts
            chart.brush = d3.brushX()
                .extent([[0, 0], [chart.width, chart.height]])
                .on('end', (event) => this.handleBrush(event, chartId));

            chart.brushGroup.call(chart.brush);
            
            // Enable double-click to reset zoom
            chart.svg.on('dblclick', () => this.resetZoom(chartId));
        } else {
            // Disable zoom for comparison charts
            chart.brush = null;
            chart.svg.on('dblclick', null);
        }
    }

    setupChartEventListeners(chartId, datasets) {
        const chartElement = document.getElementById(chartId);
        const datasetSelect = chartElement.querySelector('.chart-dataset-select');
        const variableSelect = chartElement.querySelector('.chart-variable-select');
        const binCount = chartElement.querySelector('.chart-bin-count');
        const chartTypeSelect = chartElement.querySelector('.chart-type-select');

        // Populate dataset select with available datasets
        this.populateDatasetSelect(datasetSelect, datasets);
        
        // Populate variable select with variables from first dataset
        if (datasets.length > 0) {
            this.populateVariableSelect(variableSelect, datasets[0].variables);
        }

        // Add immediate response when chart type changes
        chartTypeSelect.addEventListener('change', () => {
            console.log('Chart type changed to:', chartTypeSelect.value);
            
            // Update bin control visibility immediately
            this.updateBinControlVisibility(chartId, chartTypeSelect.value);
            
            // Update color pickers
            this.updateColorPickers(chartId);
            
            // Then update the chart
            this.updateChartFor(chartId);
        });
        
        datasetSelect.addEventListener('change', () => {
            const datasetIndex = parseInt(datasetSelect.value);
            this.updateChartDataset(chartId, datasetIndex, datasets);
        });
        
        variableSelect.addEventListener('change', () => {
            this.updateChartFor(chartId);
            this.updateChartTitle(chartId);
        });
        
        if (binCount) {
            binCount.addEventListener('change', () => this.updateChartFor(chartId));
        }
    }

    updateColorPickers(chartId) {
        const chartElement = document.getElementById(chartId);
        const chartTypeSelect = chartElement.querySelector('.chart-type-select');
        const chartControls = chartElement.querySelector('.chart-controls');
        
        if (!chartTypeSelect || !chartControls) return;
        
        const chartType = chartTypeSelect.value;
        
        // Remove existing color pickers
        const existingColorPickers = chartControls.querySelectorAll('.color-picker-container');
        existingColorPickers.forEach(picker => picker.remove());
        
        // Bin control visibility is now handled separately in updateBinControlVisibility
        
        // Add color pickers based on chart type
        if (chartType === 'compare-histogram') {
            const colorPickerContainer = this.createComparativeColorPicker(chartId);
            // Insert before remove button
            const removeButton = chartControls.querySelector('.remove-chart');
            chartControls.insertBefore(colorPickerContainer, removeButton);
        } else {
            const colorPickerContainer = this.createRegularColorPicker(chartId);
            // Insert before remove button
            const removeButton = chartControls.querySelector('.remove-chart');
            chartControls.insertBefore(colorPickerContainer, removeButton);
        }
    }

    createRegularColorPicker(chartId) {
        const container = document.createElement('div');
        container.className = 'color-picker-container';
        
        const label = document.createElement('span');
        label.className = 'color-picker-label';
        label.textContent = 'Color:';
        
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = '#F68D2E';
        colorInput.className = 'color-picker-input';
        
        container.appendChild(label);
        container.appendChild(colorInput);
        
        // Add event listener
        colorInput.addEventListener('input', () => this.updateChartColor(chartId));
        
        return container;
    }

    createComparativeColorPicker(chartId) {
        const container = document.createElement('div');
        container.className = 'color-picker-container comparative-colors';
        
        const label = document.createElement('span');
        label.className = 'color-picker-label';
        label.textContent = 'Colors:';
        
        // Container for both colors in one line
        const colorsContainer = document.createElement('div');
        colorsContainer.className = 'colors-inline-container';
        
        // Color for fraud=1
        const color1Group = document.createElement('div');
        color1Group.className = 'color-group';
        
        const color1Label = document.createElement('span');
        color1Label.className = 'color-label';
        color1Label.textContent = 'Fraud=1:';
        
        const color1Input = document.createElement('input');
        color1Input.type = 'color';
        color1Input.value = '#ff6b6b';
        color1Input.className = 'color-picker-input color-picker-1';
        color1Input.title = 'Color for fraud=1';
        
        color1Group.appendChild(color1Label);
        color1Group.appendChild(color1Input);
        
        // Color for fraud=0
        const color2Group = document.createElement('div');
        color2Group.className = 'color-group';
        
        const color2Label = document.createElement('span');
        color2Label.className = 'color-label';
        color2Label.textContent = 'Fraud=0:';
        
        const color2Input = document.createElement('input');
        color2Input.type = 'color';
        color2Input.value = '#4ecdc4';
        color2Input.className = 'color-picker-input color-picker-2';
        color2Input.title = 'Color for fraud=0';
        
        color2Group.appendChild(color2Label);
        color2Group.appendChild(color2Input);
        
        // Add both groups to inline container
        colorsContainer.appendChild(color1Group);
        colorsContainer.appendChild(color2Group);
        
        container.appendChild(label);
        container.appendChild(colorsContainer);
        
        // Add event listeners
        color1Input.addEventListener('input', () => this.updateComparativeChartColor(chartId));
        color2Input.addEventListener('input', () => this.updateComparativeChartColor(chartId));
        
        return container;
    }

    updateComparativeChartColor(chartId) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (chart && chart.compareData) {
            const chartElement = document.getElementById(chartId);
            const colorPicker1 = chartElement.querySelector('.color-picker-1');
            const colorPicker2 = chartElement.querySelector('.color-picker-2');
            
            const color1 = colorPicker1 ? colorPicker1.value : '#ff6b6b';
            const color2 = colorPicker2 ? colorPicker2.value : '#4ecdc4';
            
            // Update bars for both series
            chart.barsGroup.selectAll('.density-bar-1')
                .attr('fill', color1);
                
            chart.barsGroup.selectAll('.density-bar-2')
                .attr('fill', color2);
                
            // Update density lines
            chart.barsGroup.selectAll('.density-line-1')
                .attr('stroke', color1);
                
            chart.barsGroup.selectAll('.density-line-2')
                .attr('stroke', color2);
                
            // Update legend colors
            chart.barsGroup.selectAll('.legend-color-1')
                .attr('stroke', color1);
                
            chart.barsGroup.selectAll('.legend-color-2')
                .attr('stroke', color2);
        }
    }



    populateDatasetSelect(select, datasets) {
        select.innerHTML = '';
        datasets.forEach((dataset, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = dataset.name;
            select.appendChild(option);
        });
    }

    populateVariableSelect(select, variables) {
        select.innerHTML = '';
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a variable';
        select.appendChild(defaultOption);
        
        if (variables && variables.length > 0) {
            variables.forEach(variable => {
                const option = document.createElement('option');
                option.value = variable;
                option.textContent = variable;
                select.appendChild(option);
            });
        } else {
            console.warn('No variables available for selection');
        }
    }

    updateChartDataset(chartId, datasetIndex, datasets) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart) return;
        
        chart.datasetIndex = datasetIndex;
        
        const chartElement = document.getElementById(chartId);
        const variableSelect = chartElement.querySelector('.chart-variable-select');
        
        // Actualizar las variables para el dataset seleccionado
        if (datasets[datasetIndex] && datasets[datasetIndex].variables) {
            this.populateVariableSelect(variableSelect, datasets[datasetIndex].variables);
        }
        
        this.updateChartTitle(chartId);
        
        // Si ya había una variable seleccionada, actualizar el chart
        if (variableSelect.value) {
            this.updateChartFor(chartId);
        }
    }

    updateChartFor(chartId) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart) {
            console.error('Chart not found:', chartId);
            return;
        }

        // Clear trend line when changing chart type
        chart.trendGroup.selectAll('.trend-line, .trend-value').remove();

        const chartElement = document.getElementById(chartId);
        if (!chartElement) {
            console.error('Chart element not found:', chartId);
            return;
        }
        
        const variableSelect = chartElement.querySelector('.chart-variable-select');
        const binCount = chartElement.querySelector('.chart-bin-count');
        const chartTypeSelect = chartElement.querySelector('.chart-type-select');
        
        if (!variableSelect || !binCount || !chartTypeSelect) {
            console.error('Chart controls not found');
            return;
        }
        
        const selectedVariable = variableSelect.value;
        const binCountValue = parseInt(binCount.value);
        const chartType = chartTypeSelect.value;
        
        console.log('Update chart for:', {
            chartId,
            selectedVariable,
            binCountValue,
            chartType,
            datasetIndex: chart.datasetIndex,
            datasetsCount: this.app ? this.app.datasets.length : 'app not connected'
        });
        
        // Update bin control visibility - USE CONSISTENT APPROACH
        this.updateBinControlVisibility(chartId, chartType);
        
        if (!selectedVariable) {
            console.log('No variable selected');
            return;
        }
        
        if (!this.app || !this.app.datasets || !this.app.datasets[chart.datasetIndex]) {
            console.error('App datasets not available');
            return;
        }
        
        if (!this.app.datasets[chart.datasetIndex].data.length) {
            console.error('No data available for selected dataset');
            return;
        }

        if (chartType === 'compare-histogram') {
            // For comparison charts, IGNORE bin count - use fixed density estimation
            console.log('Comparison chart - ignoring bin count');
            
            if (!this.validateFraudFlagColumn(chart.datasetIndex)) {
                alert('Cannot create comparison chart: fraud flag column not found in dataset');
                return;
            }
            
            const compareData = this.prepareCompareData(chartId, selectedVariable);
            if (compareData) {
                chart.compareData = compareData;
                this.updateCompareChart(chart.xScale, chartId);
                
                // Update chart title for comparison
                this.updateCompareChartTitle(chartId, selectedVariable);
                
                // DISABLE ZOOM FOR COMPARISON CHARTS
                this.setupChartZoom(chartId, chartType);
                return;
            } else {
                console.log('Comparison data preparation failed, falling back to regular histogram');
                // If comparison fails, proceed with normal analysis using bins
            }
        } else {
            // Clear comparison data if switching from comparison to regular chart
            if (chart.compareData) {
                chart.compareData = null;
            }
            
            // ENABLE ZOOM FOR REGULAR CHARTS
            this.setupChartZoom(chartId, chartType);
        }

        if (chartType === 'outlier-detection') {
            console.log('Outlier detection chart - using IQR method');
            
            const outlierData = this.prepareOutlierData(chartId, selectedVariable);
            if (outlierData) {
                chart.outlierData = outlierData;
                this.updateOutlierChart(chart.xScale, chartId);
                
                // Update chart title for outlier detection
                this.updateOutlierChartTitle(chartId, selectedVariable);
                
                // Disable zoom for outlier detection
                this.setupChartZoom(chartId, chartType);
                return;
            } else {
                console.log('Outlier data preparation failed');
                return;
            }
        }
        
        // Only for NON-comparison charts use bin count
        this.analyzeData(this.app.datasets[chart.datasetIndex].data, selectedVariable, binCountValue, chartId);
    }

    validateFraudFlagColumn(datasetIndex) {
        if (!this.app || !this.app.datasets[datasetIndex]) return false;
        
        const dataset = this.app.datasets[datasetIndex];
        const fraudFlagColumn = this.config.columnMapping.fraudFlag;
        
        // Check if fraud flag column exists in the data
        if (dataset.data.length > 0 && dataset.data[0].hasOwnProperty(fraudFlagColumn)) {
            return true;
        }
        
        return false;
    }

    updateCompareChartTitle(chartId, variableName) {
        const chartElement = document.getElementById(chartId);
        if (!chartElement) return;

        const titleElement = chartElement.querySelector('.chart-title');
        if (titleElement) {
            titleElement.textContent = `${variableName} - Distribution Comparison`;
        }
    }

    updateCompareChart(xScale, chartId) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart || !chart.compareData) {
            console.error('No comparison data available');
            return;
        }

        const { series1, series2, variableName } = chart.compareData;
        
        // Set domain based on both series
        const allValues = [...series1, ...series2];
        const domain = [d3.min(allValues), d3.max(allValues)];
        chart.xScale.domain(domain);
        
        // Update chart title to indicate comparison
        this.updateCompareChartTitle(chartId, variableName);
        
        // Draw the comparative chart (this will handle axes internally)
        this.chartRenderer.drawChart(chartId, chart);
    }

    analyzeData(data, selectedVariable, binCount, chartId) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart) {
            console.error('Chart not found for analysis');
            return;
        }

        console.log('Analyzing data for variable:', selectedVariable);
        console.log('Data length:', data.length);
        console.log('Data sample:', data.slice(0, 3));

        // Verificar que la variable exista en los datos
        if (data.length === 0 || !data[0].hasOwnProperty(selectedVariable)) {
            console.error('Variable not found in data:', selectedVariable);
            alert(`Variable "${selectedVariable}" not found in the dataset`);
            return;
        }

        let values = new Float64Array(data.length);
        let flags = new Uint8Array(data.length);

        let validCount = 0;
        for (let i = 0; i < data.length; i++) {
            const val = parseFloat(data[i][selectedVariable]);
            const flag = parseInt(data[i][this.config.columnMapping.fraudFlag]);

            if (!isNaN(val) && !isNaN(flag)) {
                values[validCount] = val;
                flags[validCount] = flag;
                validCount++;
            }
        }

        if (validCount < values.length) {
            values = values.subarray(0, validCount);
            flags = flags.subarray(0, validCount);
        }

        console.log(`Valid data points: ${validCount}/${data.length}`);

        if (validCount === 0) {
            console.error('No valid data points found for analysis');
            alert('No valid numeric data found for the selected variable');
            return;
        }

        chart.chartData = {
            values,
            flags,
            selectedVariable,
            binCount,
            initialDomain: [d3.min(values), d3.max(values)]
        };

        chart.xScale.domain(chart.chartData.initialDomain).nice();
        
        // Initialize axes
        chart.xAxis.call(d3.axisBottom(chart.xScale));
        chart.yAxis.call(d3.axisLeft(chart.yScale));

        this.updateChart(chart.xScale, chartId);
    }

    updateChart(xScale, chartId) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart || !chart.chartData) {
            console.error('Chart or chart data not available');
            return;
        }

        // For comparison charts, don't draw trend line during zoom
        const chartElement = document.getElementById(chartId);
        const chartTypeSelect = chartElement ? chartElement.querySelector('.chart-type-select') : null;
        const isComparisonChart = chartTypeSelect && (chartTypeSelect.value === 'compare-histogram' || chartTypeSelect.value === 'outlier-detection');

        const { values, flags, selectedVariable, binCount } = chart.chartData;
        const domain = xScale.domain();

        console.log('Updating chart with domain:', domain);

        chart.xAxis.transition()
            .duration(750)
            .call(d3.axisBottom(xScale));

        const histogram = d3.histogram()
            .value(d => d)
            .domain(domain)
            .thresholds(binCount);

        const bins = histogram(values);

        const binsWithStats = bins.map(bin => {
            const startIdx = bin.x0 === domain[0] ? 0 : d3.bisectLeft(values, bin.x0);
            const endIdx = bin.x1 === domain[1] ? values.length : d3.bisectLeft(values, bin.x1);

            let fraudCount = 0;
            for (let i = startIdx; i < endIdx; i++) {
                fraudCount += flags[i];
            }

            const total = endIdx - startIdx;
            const fraudRate = total > 0 ? fraudCount / total : 0;
            const totalFraudRate = d3.mean(flags);
            const fraudRatio = total > 0 ? fraudRate / totalFraudRate : 0;

            return {
                xMid: (bin.x0 + bin.x1) / 2,
                x0: bin.x0,
                x1: bin.x1,
                fraudRate,
                fraudRatio,
                count: total
            };
        });

        chart.currentBins = binsWithStats;
        
        // Only calculate regression for non-comparison charts
        if (!isComparisonChart) {
            chart.currentRegression = this.calculateRegression(binsWithStats);
        } else {
            chart.currentRegression = null; // Clear regression for comparison charts
        }

        const maxBarValue = d3.max(binsWithStats, d => d.fraudRatio);
        const maxTrendValue = chart.currentRegression ?
            Math.max(
                chart.currentRegression.slope * domain[0] + chart.currentRegression.intercept,
                chart.currentRegression.slope * domain[1] + chart.currentRegression.intercept
            ) : 0;

        const maxYValue = Math.max(maxBarValue, maxTrendValue) * 1.1;
        chart.yScale.domain([0, maxYValue]);

        this.chartRenderer.drawChart(chartId, chart);
        
        // Only draw trend line for non-comparison charts
        if (!isComparisonChart) {
            this.drawTrendLine(domain, chartId);
        } else {
            // Clear any existing trend line for comparison charts
            chart.trendGroup.selectAll('.trend-line, .trend-value').remove();
        }
        
        this.drawAxesAndGrid(chartId);
        this.drawTitle(selectedVariable, binsWithStats.length, chartId);
    }

    calculateRegression(binsWithStats) {
        if (!binsWithStats || binsWithStats.length < 1) return null;
        
        if (binsWithStats.length === 1) {
            return { slope: 0, intercept: binsWithStats[0].fraudRatio };
        }

        const data = binsWithStats.map(bin => ({ x: bin.xMid, y: bin.fraudRatio }));
        const n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

        data.forEach(point => {
            sumX += point.x;
            sumY += point.y;
            sumXY += point.x * point.y;
            sumXX += point.x * point.x;
        });

        const denominator = n * sumXX - sumX * sumX;
        
        if (denominator === 0) {
            return { slope: 0, intercept: sumY / n };
        }

        const slope = (n * sumXY - sumX * sumY) / denominator;
        const intercept = (sumY - slope * sumX) / n;

        return { slope, intercept };
    }

    drawTrendLine(domain, chartId) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart) return;
        
        if (!chart.currentRegression) {
            chart.trendGroup.selectAll('.trend-line, .trend-value').remove();
            return;
        }

        const lineGenerator = d3.line()
            .x(d => chart.xScale(d.x))
            .y(d => chart.yScale(chart.currentRegression.slope * d.x + chart.currentRegression.intercept));

        const trendData = [
            { x: domain[0], y: chart.currentRegression.slope * domain[0] + chart.currentRegression.intercept },
            { x: domain[1], y: chart.currentRegression.slope * domain[1] + chart.currentRegression.intercept }
        ];

        const trendLine = chart.trendGroup.selectAll('.trend-line')
            .data([trendData]);

        trendLine.enter()
            .append('path')
            .attr('class', 'trend-line')
            .merge(trendLine)
            .transition()
            .duration(750)
            .attr('d', lineGenerator)
            .attr('opacity', 1);

        trendLine.exit()
            .transition()
            .duration(500)
            .attr('opacity', 0)
            .remove();

        const midX = (domain[0] + domain[1]) / 2;
        const midY = chart.currentRegression.slope * midX + chart.currentRegression.intercept;
        
        const midPoint = { x: midX, y: midY };

        const trendLabel = chart.trendGroup.selectAll('.trend-value')
            .data([midPoint]);

        trendLabel.enter()
            .append('text')
            .attr('class', 'trend-value')
            .merge(trendLabel)
            .transition()
            .duration(750)
            .attr('x', chart.xScale(midPoint.x))
            .attr('y', chart.yScale(midPoint.y) - 10)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('fill', 'var(--tu-blue)')
            .text(`${d3.format('.2f')(midPoint.y)}x`);

        trendLabel.exit().remove();
    }

    drawAxesAndGrid(chartId) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart) return;

        chart.yAxis
            .transition()
            .duration(750)
            .call(d3.axisLeft(chart.yScale).tickFormat(d => d3.format('.1f')(d)));

        const grid = chart.svg.selectAll('.grid').data([null]);

        grid.enter()
            .append('g')
            .attr('class', 'grid')
            .merge(grid)
            .transition()
            .duration(750)
            .call(
                d3.axisLeft(chart.yScale)
                    .tickSize(-chart.width)
                    .tickFormat('')
            )
            .call(g => g.select('.domain').remove());

        grid.exit()
            .transition()
            .duration(500)
            .remove();
    }

    drawTitle(selectedVariable, binCount, chartId) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart) return;

        const chartElement = document.getElementById(chartId);
        if (!chartElement) return;

        const titleElement = chartElement.querySelector('.chart-title');
        if (titleElement) {
            titleElement.textContent = `Analysis: ${selectedVariable || 'Select a variable'}`;
        }
        this.updateChartTitle(chartId);
    }

    updateChartTitle(chartId) {
        const chartElement = document.getElementById(chartId);
        if (!chartElement) return;

        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart) return;

        const datasetSelect = chartElement.querySelector('.chart-dataset-select');
        const variableSelect = chartElement.querySelector('.chart-variable-select');
        const titleElement = chartElement.querySelector('.chart-title');

        if (datasetSelect && variableSelect && titleElement) {
            const datasetName = datasetSelect.options[datasetSelect.selectedIndex]?.text || 'Dataset';
            const variableName = variableSelect.value || 'Select a variable';
            titleElement.textContent = `Analysis: ${variableName} (${datasetName})`;
        }
    }

    updateChartColor(chartId) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (chart && chart.currentBins) {
            const chartElement = document.getElementById(chartId);
            const colorPicker = chartElement.querySelector('.color-picker-input:not(.color-picker-1):not(.color-picker-2)');
            const color = colorPicker ? colorPicker.value : '#F68D2E';
            
            // Update regular chart elements
            chart.barsGroup.selectAll('.bar, .line-chart, .area-chart, .scatter-point, .horizontal-bar')
                .attr('fill', color)
                .attr('stroke', color);
        }
    }

    handleBrush(event, chartId) {
        if (!event.selection) return;

        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart) return;

        // Check if this is a comparison chart
        const chartElement = document.getElementById(chartId);
        const chartTypeSelect = chartElement ? chartElement.querySelector('.chart-type-select') : null;
        const isComparisonChart = chartTypeSelect && chartTypeSelect.value === 'compare-histogram';

        // Disable zoom for comparison charts
        if (isComparisonChart) {
            chart.brushGroup.call(chart.brush.move, null); // Clear brush selection
            return;
        }

        const [x0_px, x1_px] = event.selection;
        const [x0_data, x1_data] = [x0_px, x1_px].map(chart.xScale.invert);

        chart.xScale.domain([x0_data, x1_data]);
        chart.brushGroup.call(chart.brush.move, null);
        this.updateChart(chart.xScale, chartId);
    }

    resetZoom(chartId) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart || !chart.chartData) return;
        
        // Check if this is a comparison chart
        const chartElement = document.getElementById(chartId);
        const chartTypeSelect = chartElement ? chartElement.querySelector('.chart-type-select') : null;
        const isComparisonChart = chartTypeSelect && chartTypeSelect.value === 'compare-histogram';

        // Disable zoom reset for comparison charts
        if (isComparisonChart) return;
        
        chart.xScale.domain(chart.chartData.initialDomain);
        chart.isZoomed = false;
        chart.brushGroup.call(chart.brush.move, null);
        this.updateChart(chart.xScale, chartId);
    }

    removeChart(chartId) {
        console.log('Removing chart:', chartId);
        
        const chartElement = document.getElementById(chartId);
        if (chartElement) {
            chartElement.remove();
        }
        
        this.charts = this.charts.filter(chart => chart.containerId !== `chart-${chartId}`);
        
        setTimeout(() => {
            this.handleResize();
        }, 10);
    }

    handleResize() {
        this.charts.forEach(chart => {
            const chartElementId = chart.containerId.replace('chart-', '');
            if (!document.getElementById(chartElementId)) return;
            
            const container = d3.select(`#${chart.containerId}`);
            const containerNode = container.node();
            
            if (!containerNode) return;
            
            const containerWidth = containerNode.clientWidth;
            const containerHeight = containerNode.clientHeight;

            chart.width = containerWidth - this.config.margin.left - this.config.margin.right;
            chart.height = containerHeight - this.config.margin.top - this.config.margin.bottom;

            container.select('svg')
                .attr('width', containerWidth)
                .attr('height', containerHeight)
                .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`);

            // Update the chart if it has data
            if (chart.chartData) {
                this.updateChart(chart.xScale, chartElementId);
            }
        });
    }

    adjustChartSize(chartId) {
        setTimeout(() => {
            this.handleResize();
        }, 10);
    }

    updateBinControlVisibility(chartId, chartType) {
        const chartElement = document.getElementById(chartId);
        if (!chartElement) return;
        
        // Try multiple approaches to find and update bin controls
        const binContainer = chartElement.querySelector('.bin-control-container');
        const binInput = chartElement.querySelector('.chart-bin-count');
        const binLabel = chartElement.querySelector('.bin-count-label');
        
        const shouldShow = chartType !== 'compare-histogram';
        const displayValue = shouldShow ? 'flex' : 'none';
        
        console.log(`Updating bin controls: show=${shouldShow} for chartType=${chartType}`);
        
        // Update container if exists
        if (binContainer) {
            binContainer.style.display = displayValue;
            console.log('Updated bin container display');
        }
        
        // Update individual elements as fallback
        if (binInput) {
            binInput.style.display = shouldShow ? 'block' : 'none';
        }
        
        if (binLabel) {
            binLabel.style.display = shouldShow ? 'block' : 'none';
        }
        
        // If we still can't find the controls, log for debugging
        if (!binContainer && !binInput) {
            console.warn('Could not find bin controls in chart:', chartId);
            const allControls = chartElement.querySelectorAll('*');
            allControls.forEach(control => {
                if (control.className && control.className.includes('bin')) {
                    console.log('Found potential bin control:', control.className, control);
                }
            });
        }
    }

    // outliers functions
    prepareOutlierData(chartId, variableName) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart || !this.app || !this.app.datasets || this.app.datasets.length === 0) {
            console.error('No datasets available');
            return null;
        }

        const currentDataset = this.app.datasets[chart.datasetIndex];
        
        // Extract values and calculate outliers
        const values = [];
        const dataPoints = [];
        
        for (let i = 0; i < currentDataset.data.length; i++) {
            const row = currentDataset.data[i];
            const value = parseFloat(row[variableName]);
            const fraudFlag = parseInt(row[this.config.columnMapping.fraudFlag]);
            
            if (!isNaN(value)) {
                values.push(value);
                dataPoints.push({
                    value: value,
                    fraudFlag: fraudFlag,
                    index: i,
                    sessionId: row[this.config.columnMapping.sessionId] || i
                });
            }
        }

        if (values.length === 0) {
            console.error('No valid data points found');
            return null;
        }

        // Calculate outlier thresholds using IQR method
        const sortedValues = [...values].sort((a, b) => a - b);
        const q1 = this.calculateQuantile(sortedValues, 0.25);
        const q3 = this.calculateQuantile(sortedValues, 0.75);
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        // Identify outliers
        const outliers = dataPoints.filter(d => d.value < lowerBound || d.value > upperBound);
        const nonOutliers = dataPoints.filter(d => d.value >= lowerBound && d.value <= upperBound);

        console.log(`Outlier analysis: ${outliers.length} outliers out of ${dataPoints.length} total points`);
        console.log(`Bounds: [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`);

        return {
            allData: dataPoints,
            outliers: outliers,
            nonOutliers: nonOutliers,
            bounds: {
                lower: lowerBound,
                upper: upperBound,
                q1: q1,
                q3: q3,
                median: this.calculateQuantile(sortedValues, 0.5)
            },
            variableName: variableName,
            datasetName: currentDataset.name
        };
    }

    calculateQuantile(sortedArray, p) {
        const index = p * (sortedArray.length - 1);
        const lowerIndex = Math.floor(index);
        const upperIndex = Math.ceil(index);
        
        if (lowerIndex === upperIndex) {
            return sortedArray[lowerIndex];
        }
        
        // Linear interpolation
        const weight = index - lowerIndex;
        return sortedArray[lowerIndex] * (1 - weight) + sortedArray[upperIndex] * weight;
    }

    updateOutlierChart(xScale, chartId) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart || !chart.outlierData) {
            console.error('No outlier data available');
            return;
        }

        const { variableName } = chart.outlierData;
        
        // Set domain based on all data
        const allValues = chart.outlierData.allData.map(d => d.value);
        const domain = [d3.min(allValues), d3.max(allValues)];
        chart.xScale.domain(domain);
        
        // Update chart title
        this.updateOutlierChartTitle(chartId, variableName);
        
        // Draw the outlier chart
        this.chartRenderer.drawChart(chartId, chart);
    }

    updateOutlierChartTitle(chartId, variableName) {
        const chartElement = document.getElementById(chartId);
        if (!chartElement) return;

        const titleElement = chartElement.querySelector('.chart-title');
        if (titleElement) {
            titleElement.textContent = `${variableName} - Outlier Detection`;
        }
    }
}