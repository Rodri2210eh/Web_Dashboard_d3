// Chart configuration constants
const width = 800;
const height = 500;
const margin = { top: 40, right: 40, bottom: 60, left: 60 };

// Required column name mappings
const COLUMN_MAPPING = {
    fraudFlag: 'fraud_combined',
    sessionId: 'sessionid'
};

// Global variables
let currentData = [];
let availableVariables = [];
let charts = [];
let idleTimeout;

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById("file-upload").addEventListener("change", handleFileUpload);
    document.getElementById("add-chart").addEventListener("click", addNewChart);
}

window.addEventListener('resize', handleResize);

/**
 * Handles chart resizing while maintaining a strict 2-column grid layout
 * - Updates internal chart dimensions when container size changes
 * - CSS grid handles the external layout (2-column pattern)
 * - Only adjusts the SVG and chart elements, not the container positioning
 */
function handleResize() {
    // Loop through all active charts
    charts.forEach(chart => {
        // Skip if chart container doesn't exist in DOM
        if (!document.getElementById(chart.containerId)) return;
        
        // Select the chart container and get its current dimensions
        const container = d3.select(`#${chart.containerId}`);
        const containerWidth = container.node().clientWidth;  // Current width
        const containerHeight = container.node().clientHeight; // Current height

        // Calculate chart dimensions accounting for margins
        chart.width = containerWidth - margin.left - margin.right;
        chart.height = containerHeight - margin.top - margin.bottom;

        // Update SVG dimensions to fill container
        container.select('svg')
            .attr('width', containerWidth)       // Set absolute width
            .attr('height', containerHeight)     // Set absolute height
            .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`); // Responsive scaling

        // Redraw chart contents with new dimensions
        updateChart(chart.xScale, chart.containerId.replace('chart-', ''));
    });
}

function initializeChart(containerId) {
    console.log("containerId inicial: ", containerId)
    const container = d3.select(`#${containerId}`);
    
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    
    const chartWidth = containerWidth - margin.left - margin.right;
    const chartHeight = containerHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", '100%')
        .attr("height", '100%')
        .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .on("mousemove", function(event) {
            if (!event.buttons) {
                const [x, y] = d3.pointer(event, this);
                const chart = charts.find(c => c.containerId === containerId);
                if (!chart || !chart.currentBins) return;
                
                const xValue = chart.xScale.invert(x - margin.left);
                
                const bin = chart.currentBins.find(b => {
                    const x0 = chart.xScale(b.x0);
                    const x1 = chart.xScale(b.x1);
                    return x >= x0 && x <= x1;
                });
                
                if (bin) {
                    showTooltip(event, bin, containerId.replace('chart-', ''));
                } else {
                    hideTooltip(containerId.replace('chart-', ''));
                }
            }
        })
        .on("mouseout", () => hideTooltip(containerId.replace('chart-', '')));

    const clip = svg.append("defs").append("clipPath")
        .attr("id", `clip-${containerId}`)
        .append("rect")
        .attr("width", chartWidth)
        .attr("height", chartHeight);

    const chartGroup = svg.append('g')
        .attr("clip-path", `url(#clip-${containerId})`);

    const barsGroup = chartGroup.append('g').attr('class', 'bars-group');
    const trendGroup = chartGroup.append('g').attr('class', 'trend-group');
    const hitAreaGroup = svg.append('g').attr('class', 'hit-area-group');
    const axesGroup = svg.append('g').attr('class', 'axes-group');
    
    const xAxis = axesGroup.append("g")
        .attr("class", "x-axis axis")
        .attr("transform", `translate(0,${height})`);
        
    const yAxis = axesGroup.append("g").attr("class", "y-axis axis");
    
    const brushGroup = svg.append('g').attr('class', 'brush-group');
    const brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("end", function(event) {
            console.log("Brush Event:", event.selection);
            brushed(event, containerId.replace('chart-', ''));
        });

    brushGroup.call(brush);

    console.log("Brush Group element:", brushGroup.node());
    
    svg.on("dblclick", () => resetZoom(containerId.replace('chart-', '')));
    

    return {
        containerId,
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
        height: chartHeight
    };
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    showFileMessage(`Processing: ${file.name}...`, 'info');

    try {
        let processedData;

        if (file.name.endsWith('.parquet')) {
            processedData = await processParquetFile(file);
        } else {
            processedData = await processCSVFile(file);
        }

        if (!processedData || !processedData.sampledData || !Array.isArray(processedData.sampledData) || processedData.sampledData.length === 0) {
            throw new Error('File contains no valid data');
        }

        currentData = processedData.sampledData;
        availableVariables = processedData.availableVariables;

        showFileMessage(`Loaded: ${file.name} (${processedData.totalRecords.toLocaleString()} records)`, 'success');
        
        // Clear existing charts
        document.getElementById('charts-grid').innerHTML = '';
        charts = [];
        
        addNewChart();
    } catch (error) {
        console.error("File processing error:", error);
        showFileError(error.message || 'File processing error');
    }
}

/**
 * Creates and initializes a new chart in the dashboard
 * - Sets up DOM structure
 * - Configures chart controls (variable selector, bin count, color picker)
 * - Handles event listeners
 * - Initializes D3 visualization
 */
function addNewChart() {
    // Validate data availability
    if (!currentData.length) {
        alert("Please load data first");
        return;
    }

    // Generate unique chart ID
    const chartId = `chart-${Date.now()}`;
    console.log("Creating new chart:", chartId);

    // Get charts grid container
    const chartsGrid = document.getElementById('charts-grid');
    
    // Create chart wrapper div
    const chartWrapper = document.createElement('div');
    chartWrapper.className = 'chart-wrapper';
    chartWrapper.id = chartId;
    
    // Create header section
    const chartHeader = document.createElement('div');
    chartHeader.className = 'chart-header';
    
    // Chart title
    const chartTitle = document.createElement('h3');
    chartTitle.className = 'chart-title';
    chartTitle.textContent = 'Analysis: Select a variable';
    
    // Create controls container
    const chartControls = document.createElement('div');
    chartControls.className = 'chart-controls';
    
    // Variable selection dropdown
    const variableSelect = document.createElement('select');
    variableSelect.className = 'chart-variable-select';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a variable';
    variableSelect.appendChild(defaultOption);
    
    // Populate variables dropdown
    availableVariables.forEach(varName => {
        const option = document.createElement('option');
        option.value = varName;
        option.textContent = varName;
        variableSelect.appendChild(option);
    });
    
    // Bin count input
    const binCount = document.createElement('input');
    binCount.type = 'number';
    binCount.min = '3';
    binCount.max = '20';
    binCount.value = '10';
    binCount.className = 'chart-bin-count';
    
    // Color picker components
    const colorPickerLabel = document.createElement('span');
    colorPickerLabel.className = 'color-picker-label';
    colorPickerLabel.textContent = 'Color:';
    
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = '#F68D2E'; // Default orange
    colorPicker.className = 'color-picker-input';
    
    const colorPickerContainer = document.createElement('div');
    colorPickerContainer.className = 'color-picker';
    colorPickerContainer.appendChild(colorPickerLabel);
    colorPickerContainer.appendChild(colorPicker);
    
    // Remove chart button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-chart';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => removeChart(chartId);
    
    // Assemble controls
    chartControls.appendChild(variableSelect);
    chartControls.appendChild(binCount);
    chartControls.appendChild(colorPickerContainer);
    chartControls.appendChild(removeBtn);
    
    // Assemble header
    chartHeader.appendChild(chartTitle);
    chartHeader.appendChild(chartControls);
    
    // Create chart container
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart';
    chartDiv.id = `chart-${chartId}`;
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.style.opacity = '0';
    tooltip.id = `tooltip-${chartId}`;
    
    // Assemble chart wrapper
    chartWrapper.appendChild(chartHeader);
    chartWrapper.appendChild(chartDiv);
    chartWrapper.appendChild(tooltip);
    
    // Add to DOM
    chartsGrid.appendChild(chartWrapper);
    
    // Initialize D3 chart
    const chart = initializeChart(chartDiv.id);
    charts.push(chart);

    // Event listeners
    variableSelect.addEventListener('change', () => {
        updateChartFor(chartId);
        const selectedVar = variableSelect.value || 'Select a variable';
        chartTitle.textContent = `Analysis: ${selectedVar}`;
    });
    binCount.addEventListener('change', () => updateChartFor(chartId));
    
    // Dual event listeners for color picker (instant + finalized changes)
    colorPicker.addEventListener('input', function() {
        const chart = charts.find(c => c.containerId === `chart-${chartId}`);
        if (chart && chart.currentBins) {
            // Force immediate color update without full redraw
            chart.barsGroup.selectAll('.bar')
                .attr('fill', this.value);
        }
    });
    colorPicker.addEventListener('change', () => updateChartFor(chartId));
    
    // Initialize chart if default variable is selected
    if (variableSelect.value) {
        updateChartFor(chartId);
    }

    setTimeout(() => {
        handleResize();
    }, 10);
}

function removeChart(chartId) {
    console.log("Removing chart:", chartId);
    
    // 1. Find and remove the chart element
    const chartElement = document.getElementById(chartId);
    if (chartElement) {
        chartElement.remove();
    }
    
    // 2. Remove from charts array
    charts = charts.filter(chart => chart.containerId !== `chart-${chartId}`);
    
    // 3. Force a resize after DOM update
    setTimeout(() => {
        handleResize();
    }, 10); // Small delay to ensure DOM is updated
}

function updateChartFor(chartId) {
    console.log("updateChartFor", chartId)
    const chart = charts.find(c => c.containerId === `chart-${chartId}`);
    if (!chart) return;
    
    const chartElement = document.getElementById(chartId);
    const variableSelect = chartElement.querySelector('.chart-variable-select');
    const binCount = chartElement.querySelector('.chart-bin-count');
    
    const selectedVariable = variableSelect.value;
    const binCountValue = parseInt(binCount.value);
    
    if (!selectedVariable || !currentData.length) return;
    
    analyzeData(currentData, selectedVariable, binCountValue, chartId);
}

function analyzeData(data, selectedVariable, binCount, chartId) {
    console.log("analyzeData", chartId)
    const chart = charts.find(c => c.containerId === `chart-${chartId}`);
    if (!chart) return;

    let values = new Float64Array(data.length);
    let flags = new Uint8Array(data.length);

    let validCount = 0;
    for (let i = 0; i < data.length; i++) {
        const val = parseFloat(data[i][selectedVariable]);
        const flag = parseInt(data[i][COLUMN_MAPPING.fraudFlag]);

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

    chart.chartData = {
        values,
        flags,
        selectedVariable,
        binCount,
        initialDomain: [d3.min(values), d3.max(values)]
    };

    chart.xScale.domain(chart.chartData.initialDomain).nice();
    chart.xAxis.call(d3.axisBottom(chart.xScale));
    chart.yAxis.call(d3.axisLeft(chart.yScale));

    updateChart(chart.xScale, chartId);
}

function updateChart(xScale, chartId) {
    console.log("updateChart", chartId)
    const chart = charts.find(c => c.containerId === `chart-${chartId}`);
    if (!chart || !chart.chartData) return;

    const { values, flags, selectedVariable, binCount } = chart.chartData;
    const domain = xScale.domain();

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

    chart.currentRegression = binsWithStats.length >= 2 ?
        linearRegression(binsWithStats.map(bin => ({
            x: bin.xMid,
            y: bin.fraudRatio
        }))) :
        null;

    const maxBarValue = d3.max(binsWithStats, d => d.fraudRatio);
    const maxTrendValue = chart.currentRegression ?
        Math.max(
            chart.currentRegression.slope * domain[0] + chart.currentRegression.intercept,
            chart.currentRegression.slope * domain[1] + chart.currentRegression.intercept
        ) : 0;

    const maxYValue = Math.max(maxBarValue, maxTrendValue) * 1.1;
    chart.yScale.domain([0, maxYValue]);

    drawBars(binsWithStats, chartId);
    drawTrendLine(domain, chartId);
    drawAxesAndGrid(chartId);
    drawTitle(selectedVariable, binsWithStats.length, chartId);
}

/**
 * Draws or updates bar chart visualization for a specific chart
 * @param {Array} binsWithStats - Array of bin objects containing statistical data
 * @param {string} chartId - Unique identifier for the chart container
 */
function drawBars(binsWithStats, chartId) {
    console.log("drawBars", chartId)
    
    // Find the chart configuration from the global charts array
    const chart = charts.find(c => c.containerId === `chart-${chartId}`);
    if (!chart) return; // Exit if chart not found

    // 1. Get current color from the color picker input
    const chartElement = document.getElementById(chartId);
    const colorPicker = chartElement.querySelector('.color-picker-input');
    // Fallback to CSS variable if color picker not found
    const barColor = colorPicker ? colorPicker.value : 'var(--tu-orange)';

    // 2. Data join pattern: Handle entering, updating, and exiting bars
    const bars = chart.barsGroup.selectAll('.bar')
        // Bind data using x0 as key for object constancy
        .data(binsWithStats, d => d.x0)
        // Immediately apply color to all bars (existing and new)
        .attr('fill', barColor);

    // Handle exiting bars (removed from dataset)
    bars.exit()
        .transition()
        .duration(250)
        .attr('y', height) // Move to bottom
        .attr('height', 0) // Collapse height
        .remove(); // Remove from DOM

    // Update existing bars with smooth transitions
    bars.transition()
        .duration(1000)
        // Position and size bars based on data
        .attr('x', d => chart.xScale(d.x0))
        .attr('width', d => Math.max(1, chart.xScale(d.x1) - chart.xScale(d.x0) - 1))
        .attr('y', d => chart.yScale(d.fraudRatio))
        .attr('height', d => height - chart.yScale(d.fraudRatio));

    // Handle new bars (added to dataset)
    bars.enter()
        .append('rect')
        .attr('class', 'bar')
        // Initial properties for entering bars
        .attr('x', d => chart.xScale(d.x0))
        .attr('width', d => Math.max(1, chart.xScale(d.x1) - chart.xScale(d.x0) - 1))
        .attr('y', height) // Start at bottom
        .attr('height', 0) // Start collapsed
        .attr('fill', barColor)
        .attr('rx', 2) // Rounded corners
        .attr('ry', 2)
        // Animate to final position/size
        .transition()
        .duration(750)
        .attr('y', d => chart.yScale(d.fraudRatio))
        .attr('height', d => height - chart.yScale(d.fraudRatio));
}

function drawTrendLine(domain, chartId) {
    console.log("drawTrendLine", chartId)
    const chart = charts.find(c => c.containerId === `chart-${chartId}`);
    if (!chart || !chart.currentRegression) {
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

    trendLine.transition()
        .duration(750)
        .attr('d', lineGenerator);

    trendLine.enter()
        .append('path')
        .attr('class', 'trend-line')
        .attr('d', lineGenerator)
        .attr('opacity', 0)
        .transition()
        .duration(750)
        .attr('opacity', 1);

    trendLine.exit()
        .transition()
        .duration(500)
        .attr('opacity', 0)
        .remove();

    const lastPoint = trendData[1];
    const trendLabel = chart.trendGroup.selectAll('.trend-value')
        .data([lastPoint]);

    trendLabel.enter()
        .append('text')
        .attr('class', 'trend-value')
        .attr('x', chart.xScale(lastPoint.x) - 5)
        .attr('y', chart.yScale(lastPoint.y) - 5)
        .attr('text-anchor', 'end')
        .style('font-size', '10px')
        .style('font-weight', 'bold')
        .style('fill', 'var(--tu-blue)')
        .text(`${d3.format('.2f')(lastPoint.y)}x`);

    trendLabel.exit().remove();
}

/*function updateHitAreas(binsWithStats, chartId) {
    console.log("updateHitAreas", chartId);
    const chart = charts.find(c => c.containerId === `chart-${chartId}`);
    if (!chart) return;

    // Usa chart.hitAreaGroup en lugar de chart.barsGroup
    const hitAreas = chart.hitAreaGroup.selectAll('.bar-hit-area')
        .data(binsWithStats, d => d.x0);

    hitAreas.exit().remove();

    hitAreas.enter()
        .append('rect') // Cambiado de insert() a append()
        .attr('class', 'bar-hit-area')
        .attr('x', d => chart.xScale(d.x0))
        .attr('width', d => Math.max(1, chart.xScale(d.x1) - chart.xScale(d.x0) - 1))
        .attr('y', 0)
        .attr('height', height)
        .attr('opacity', 0)
        .style('pointer-events', 'auto') // Asegura que reciba eventos
        .on('mouseover', (event, d) => {
            console.log("Mouseover detected on hit area"); // Debug
            showTooltip(event, d, chartId);
        })
        .on('mouseout', () => {
            console.log("Mouseout detected"); // Debug
            hideTooltip(chartId);
        });
}*/

function drawAxesAndGrid(chartId) {
    console.log("drawAxesAndGrid", chartId)
    const chart = charts.find(c => c.containerId === `chart-${chartId}`);
    if (!chart) return;

    // 1. Animate Y-axis update
    chart.yAxis
        .transition() // ← Preserve transition
        .duration(750)
        .call(d3.axisLeft(chart.yScale).tickFormat(d => d3.format('.1f')(d)));

    // 2. Handle grid with transitions
    const grid = chart.svg.selectAll('.grid').data([null]);

    // Enter + Update
    grid.enter()
        .append('g')
        .attr('class', 'grid')
        .merge(grid)
        .transition() // ← Animate grid lines
        .duration(750)
        .call(
            d3.axisLeft(chart.yScale)
                .tickSize(-width)  // Full-width grid lines
                .tickFormat('')     // Hide labels
        )
        .call(g => g.select('.domain').remove()); // Remove axis line

    // Exit (if needed)
    grid.exit()
        .transition()
        .duration(500)
        .remove();
}

function drawTitle(selectedVariable, binCount, chartId) {
    console.log("drawTitle", chartId)
    const chart = charts.find(c => c.containerId === `chart-${chartId}`);
    if (!chart) return;

    const chartElement = document.getElementById(chartId);
    if (!chartElement) return;

    const titleElement = chartElement.querySelector('.chart-title');
    if (titleElement) {
        titleElement.textContent = `Analysis: ${selectedVariable || 'Select a variable'}`;
    }

}

function showTooltip(event, d, chartId) {
    console.log("showTooltip", chartId)
    const chart = charts.find(c => c.containerId === `chart-${chartId}`);
    if (!chart) return;

    const tooltip = d3.select(`#tooltip-${chartId}`);
    tooltip
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY - 20}px`);
    console.log("Tooltip element:", tooltip.node());
    tooltip.transition().duration(200).style('opacity', 0.9);

    const expectedValue = chart.currentRegression ?
        chart.currentRegression.slope * d.xMid + chart.currentRegression.intercept : null;

    tooltip.html(`
        <div><strong>Range:</strong> ${d3.format(',')(d.x0)} - ${d3.format(',')(d.x1)}</div>
        <div><strong>Fraud Ratio:</strong> ${d3.format('.2f')(d.fraudRatio)}x</div>
        ${expectedValue ? `
        <div><strong>Expected Trend:</strong> ${d3.format('.2f')(expectedValue)}x</div>
        <div><strong>Deviation:</strong> ${d3.format('+.2f')(d.fraudRatio - expectedValue)}x</div>
        ` : ''}
        <div><strong>Fraud Rate:</strong> ${d3.format('.1%')(d.fraudRate)}</div>
        <div><strong>Transactions:</strong> ${d.count.toLocaleString()}</div>
    `)
    .style('left', `${event.pageX}px`)
    .style('top', `${event.pageY}px`);
}

function hideTooltip(chartId) {
    d3.select(`#tooltip-${chartId}`).transition().duration(500).style('opacity', 0);
}

function brushed(event, chartId) {
    console.log("[1] Event object:", event);  // Inspect full event
    if (!event.selection) {
        console.warn("[2] Ignoring null selection");
        return;  // Early exit if no selection
    }

    const chart = charts.find(c => c.containerId === `chart-${chartId}`);
    if (!chart) {
        console.error("[3] Chart not found for ID:", `${chartId}`);
        return;
    }

    // Debug coordinate conversion
    const [x0_px, x1_px] = event.selection;
    console.log("[4] Pixel coordinates:", x0_px, x1_px);

    const [x0_data, x1_data] = [x0_px, x1_px].map(chart.xScale.invert);
    console.log("[5] Data domain:", x0_data, x1_data);  // Should log here!

    // Proceed with zoom
    chart.xScale.domain([x0_data, x1_data]);
    chart.brushGroup.call(chart.brush.move, null);
    updateChart(chart.xScale, chartId);
}

function resetZoom(chartId) {
    console.log("Reset: ", chartId)
    const chart = charts.find(c => c.containerId === `chart-${chartId}`);
    if (!chart || !chart.chartData) return;
    
    // Reset to initial domain
    chart.xScale.domain(chart.chartData.initialDomain);
    chart.isZoomed = false;
    
    // Clear any brush selection visually
    chart.brushGroup.call(chart.brush.move, null);
    
    // Update the chart
    updateChart(chart.xScale, chartId);
}

function linearRegression(data) {
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    data.forEach(point => {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumXX += point.x * point.x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

async function processParquetFile(file) {
    if (typeof parquet === 'undefined' || !parquet.ParquetReader) {
        throw new Error('Parquet library not loaded. Please refresh the page.');
    }

    try {
        const buffer = await readFileAsArrayBuffer(file);
        const reader = await parquet.ParquetReader.openBuffer(buffer);
        const cursor = reader.getCursor();

        const data = [];
        const columnList = reader.getSchema().fieldList.map(f => f.name);

        if (!columnList.includes(COLUMN_MAPPING.fraudFlag)) {
            await reader.close();
            throw new Error(`File must contain '${COLUMN_MAPPING.fraudFlag}' column`);
        }

        let row;
        while ((row = await cursor.next())) {
            data.push(row);
        }

        await reader.close();

        const availableVariables = columnList.filter(
            col => ![COLUMN_MAPPING.fraudFlag, COLUMN_MAPPING.sessionId].includes(col.toLowerCase())
        );

        return {
            sampledData: data,
            availableVariables,
            totalRecords: data.length
        };
    } catch (error) {
        console.error('Parquet processing error:', error);
        throw new Error(`Parquet processing failed: ${error.message}`);
    }
}

async function processCSVFile(file) {
    return new Promise((resolve, reject) => {
        const worker = new Worker('js/worker.js');

        worker.onmessage = function(e) {
            if (e.data.error) {
                reject(new Error(e.data.error));
                return;
            }

            if (!e.data.sampledData || !Array.isArray(e.data.sampledData)) {
                reject(new Error('Invalid data format'));
                return;
            }

            worker.terminate();
            resolve(e.data);
        };

        worker.onerror = (error) => {
            reject(new Error(`Worker error: ${error.message}`));
            worker.terminate();
        };

        worker.postMessage({
            file: file,
            columnMappings: COLUMN_MAPPING
        });
    });
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('File read error'));
        reader.onabort = () => reject(new Error('File read aborted'));

        reader.readAsArrayBuffer(file);
    });
}

function showFileMessage(message, type = 'info') {
    const element = document.getElementById("file-info");
    element.textContent = message;
    element.style.color = type === 'error' ? 'red' :
        type === 'success' ? 'var(--tu-blue)' :
        'var(--tu-dark-gray)';
}

function showFileError(message) {
    showFileMessage(message, 'error');
}