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
        this.adjustChartSize(chartId);

        return chart;
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
            this.createBinCountInput(),
            this.createChartTypeSelect(),
            this.createColorPicker(),
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
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '3';
        input.max = '20';
        input.value = '10';
        input.className = 'chart-bin-count';
        return input;
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
            { value: 'dot', text: 'Dot Plot' }
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
        label.textContent = 'Color:';
        
        const input = document.createElement('input');
        input.type = 'color';
        input.value = '#F68D2E';
        input.className = 'color-picker-input';
        
        container.appendChild(label);
        container.appendChild(input);
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
        
        const brushGroup = svg.append('g').attr('class', 'brush-group');
        const brush = d3.brushX()
            .extent([[0, 0], [chartWidth, chartHeight]])
            .on('end', (event) => this.handleBrush(event, containerId));

        brushGroup.call(brush);
        
        svg.on('dblclick', () => this.resetZoom(containerId));

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

    setupChartEventListeners(chartId, datasets) {
        const chartElement = document.getElementById(chartId);
        const datasetSelect = chartElement.querySelector('.chart-dataset-select');
        const variableSelect = chartElement.querySelector('.chart-variable-select');
        const binCount = chartElement.querySelector('.chart-bin-count');
        const chartTypeSelect = chartElement.querySelector('.chart-type-select');
        const colorPicker = chartElement.querySelector('.color-picker-input');

        // Poblar el dataset select con los datasets disponibles
        this.populateDatasetSelect(datasetSelect, datasets);
        
        // Poblar el variable select con las variables del primer dataset
        if (datasets.length > 0) {
            this.populateVariableSelect(variableSelect, datasets[0].variables);
        }

        datasetSelect.addEventListener('change', () => {
            const datasetIndex = parseInt(datasetSelect.value);
            this.updateChartDataset(chartId, datasetIndex, datasets);
        });
        
        variableSelect.addEventListener('change', () => {
            this.updateChartFor(chartId);
            this.updateChartTitle(chartId);
        });
        
        binCount.addEventListener('change', () => this.updateChartFor(chartId));
        
        chartTypeSelect.addEventListener('change', () => this.updateChartFor(chartId));
        
        colorPicker.addEventListener('input', () => this.updateChartColor(chartId));
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
        
        const chartElement = document.getElementById(chartId);
        if (!chartElement) {
            console.error('Chart element not found:', chartId);
            return;
        }
        
        const variableSelect = chartElement.querySelector('.chart-variable-select');
        const binCount = chartElement.querySelector('.chart-bin-count');
        
        if (!variableSelect || !binCount) {
            console.error('Chart controls not found');
            return;
        }
        
        const selectedVariable = variableSelect.value;
        const binCountValue = parseInt(binCount.value);
        
        console.log('Update chart for:', {
            chartId,
            selectedVariable,
            binCountValue,
            datasetIndex: chart.datasetIndex,
            datasetsCount: this.app ? this.app.datasets.length : 'app not connected'
        });
        
        // Usar this.app.datasets en lugar de window.app.datasets
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
        
        this.analyzeData(this.app.datasets[chart.datasetIndex].data, selectedVariable, binCountValue, chartId);
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
        chart.currentRegression = this.calculateRegression(binsWithStats);

        const maxBarValue = d3.max(binsWithStats, d => d.fraudRatio);
        const maxTrendValue = chart.currentRegression ?
            Math.max(
                chart.currentRegression.slope * domain[0] + chart.currentRegression.intercept,
                chart.currentRegression.slope * domain[1] + chart.currentRegression.intercept
            ) : 0;

        const maxYValue = Math.max(maxBarValue, maxTrendValue) * 1.1;
        chart.yScale.domain([0, maxYValue]);

        this.chartRenderer.drawChart(chartId, chart);
        this.drawTrendLine(domain, chartId);
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
            const colorPicker = chartElement.querySelector('.color-picker-input');
            const color = colorPicker ? colorPicker.value : '#F68D2E';
            
            chart.barsGroup.selectAll('.bar, .line-chart, .area-chart, .scatter-point, .horizontal-bar')
                .attr('fill', color)
                .attr('stroke', color);
        }
    }

    handleBrush(event, chartId) {
        if (!event.selection) return;

        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart) return;

        const [x0_px, x1_px] = event.selection;
        const [x0_data, x1_data] = [x0_px, x1_px].map(chart.xScale.invert);

        chart.xScale.domain([x0_data, x1_data]);
        chart.brushGroup.call(chart.brush.move, null);
        this.updateChart(chart.xScale, chartId);
    }

    resetZoom(chartId) {
        const chart = this.charts.find(c => c.containerId === `chart-${chartId}`);
        if (!chart || !chart.chartData) return;
        
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
}