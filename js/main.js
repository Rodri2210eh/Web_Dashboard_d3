// Chart configuration constants

const width = 800;

const height = 500;

const margin = { top: 40, right: 40, bottom: 60, left: 60 };

 

// Required column name mappings

const COLUMN_MAPPING = {

    fraudFlag: 'fraud_combined', // Fraud flag column (1=fraud, 0=legitimate)

    sessionId: 'sessionid' // Session identifier column

};

 

// Create SVG container with margins

const svg = d3.select("#chart")

    .append("svg")

    .attr("width", width + margin.left + margin.right)

    .attr("height", height + margin.top + margin.bottom)

    .append("g")

    .attr("transform", `translate(${margin.left},${margin.top})`);

 

// Global variables

let currentData = []; // Processed dataset for visualization

let availableVariables = []; // List of available analysis variables

let xScale, yScale; // D3 scale functions

let xAxis, yAxis; // D3 axis objects

let brush; // Brush component for zooming

let clip; // Clip path definition

let barsGroup, trendGroup; // SVG groups for visual elements

let axesGroup, brushGroup; // SVG groups for axes and brush

let idleTimeout; // Timeout reference for brush idle state

let isZoomed = false; // Zoom state flag

let currentBins = []; // Current histogram bin data

let currentRegression = null; // Current regression parameters

 

// Initialize application when DOM is ready

document.addEventListener('DOMContentLoaded', () => {

    setupEventListeners();

    initializeChart();

});

 

/**

 * Sets up event listeners for UI controls

 */

function setupEventListeners() {

    // File upload handler

    document.getElementById("file-upload").addEventListener("change", handleFileUpload);

 

    // Analysis controls

    document.getElementById("variable-select").addEventListener("change", updateChartBasedOnSelection);

    document.getElementById("bin-count").addEventListener("change", updateChartBasedOnSelection);

}

 

/**

 * Initializes chart structure and scales

 */

function initializeChart() {

    // Define clipping area to prevent overflow

    clip = svg.append("defs").append("clipPath")

        .attr("id", "clip")

        .append("rect")

        .attr("width", width)

        .attr("height", height);

 

    // Main chart group with clipping

    chartGroup = svg.append('g')

        .attr("clip-path", "url(#clip)");

 

    // Create dedicated SVG groups

    barsGroup = chartGroup.append('g').attr('class', 'bars-group'); // For histogram bars

    trendGroup = chartGroup.append('g').attr('class', 'trend-group'); // For trend line

 

    // Axes and grid elements

    axesGroup = svg.append('g').attr('class', 'axes-group');

    xAxis = axesGroup.append("g")

        .attr("class", "x-axis axis")

        .attr("transform", `translate(0,${height})`);

    yAxis = axesGroup.append("g").attr("class", "y-axis axis");

    axesGroup.append('g').attr('class', 'grid');

 

    // Brush group (top layer)

    brushGroup = svg.append('g').attr('class', 'brush-group');

 

    // Initialize scales

    xScale = d3.scaleLinear().range([0, width]);

    yScale = d3.scaleLinear().range([height, 0]);

 

    // Configure zoom brush

    brush = d3.brushX()

        .extent([

            [0, 0],

            [width, height]

        ])

        .on("end", brushed);

 

    brushGroup.call(brush);

 

    // Double-click zoom reset

    svg.on("dblclick", resetZoom);

}

 

/**

 * Handles file upload and processing

 * @param {Event} event - File input change event

 */

async function handleFileUpload(event) {

    const file = event.target.files[0];

    if (!file) return;

 

    // Reset UI state

    document.getElementById("variable-select").disabled = true;

    document.getElementById("bin-count").disabled = true;

 

    // Validate file type

    const isValidFile = file.name.endsWith('.csv') || file.name.endsWith('.parquet');

    if (!isValidFile) {

        showFileError('Please upload a CSV or Parquet file');

        return;

    }

 

    showFileMessage(`Processing: ${file.name}...`, 'info');

 

    try {

        let processedData;

 

        // Process based on file type

        if (file.name.endsWith('.parquet')) {

            processedData = await processParquetFile(file);

        } else {

            processedData = await processCSVFile(file);

        }

 

        // Validate processed data

        if (!processedData || !processedData.sampledData || !Array.isArray(processedData.sampledData) || processedData.sampledData.length === 0) {

            throw new Error('File contains no valid data');

        }

 

        currentData = processedData.sampledData;

        availableVariables = processedData.availableVariables;

 

        updateUIAfterProcessing(file.name, processedData.totalRecords);

        showFileMessage(`Loaded: ${file.name} (${processedData.totalRecords.toLocaleString()} records)`, 'success');

    } catch (error) {

        console.error("File processing error:", error);

        handleProcessingError(error);

    }

}

 

/**

 * Processes Parquet file data

 * @param {File} file - Parquet file to process

 */

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

 

        // Validate required columns

        if (!columnList.includes(COLUMN_MAPPING.fraudFlag)) {

            await reader.close();

            throw new Error(`File must contain '${COLUMN_MAPPING.fraudFlag}' column`);

        }

 

        // Read all records

        let row;

        while ((row = await cursor.next())) {

            data.push(row);

        }

 

        await reader.close();

 

        // Determine available analysis variables

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

 

/**

 * Processes CSV file using Web Worker

 * @param {File} file - CSV file to process

 */

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

 

/**

 * Reads file as ArrayBuffer

 * @param {File} file - File to read

 */

function readFileAsArrayBuffer(file) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();

 

        reader.onload = () => resolve(reader.result);

        reader.onerror = () => reject(new Error('File read error'));

        reader.onabort = () => reject(new Error('File read aborted'));

 

        reader.readAsArrayBuffer(file);

    });

}

 

/**

 * Updates UI after successful file processing

 * @param {string} filename - Processed filename

 * @param {number} totalRecords - Total records count

 */

function updateUIAfterProcessing(filename, totalRecords) {

    const variableSelect = document.getElementById("variable-select");

    variableSelect.innerHTML = '';

 

    // Add default option

    variableSelect.appendChild(createOption("", "Select a variable"));

 

    // Add available variables

    availableVariables.forEach(varName => {

        variableSelect.appendChild(createOption(varName, varName));

    });

 

    // Enable controls

    variableSelect.disabled = false;

    document.getElementById("bin-count").disabled = false;

}

 

/**

 * Creates option element for select

 * @param {string} value - Option value

 * @param {string} text - Option text

 */

function createOption(value, text) {

    const option = document.createElement("option");

    option.value = value;

    option.textContent = text;

    return option;

}

 

/**

 * Displays file processing message

 * @param {string} message - Message to display

 * @param {string} type - Message type ('info', 'success', 'error')

 */

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

 

/**

 * Handles file processing errors

 * @param {Error} error - Error object

 */

function handleProcessingError(error) {

    let errorMessage = 'File processing error';

 

    if (error.message.includes('permission') || error.message.includes('read')) {

        errorMessage = 'Permission error. Is the file open in another program?';

    } else if (error.message.includes(COLUMN_MAPPING.fraudFlag)) {

        errorMessage = `Error: File must contain '${COLUMN_MAPPING.fraudFlag}' column`;

    } else {

        errorMessage = `Error: ${error.message || 'Unknown error'}`;

    }

 

    showFileError(errorMessage);

    currentData = [];

    availableVariables = [];

}

 

/**

 * Updates chart when variable or bin count changes

 */

function updateChartBasedOnSelection() {

    const selectedVariable = document.getElementById("variable-select").value;

    const binCount = parseInt(document.getElementById("bin-count").value);

 

    if (!selectedVariable || !currentData.length) return;

 

    analyzeData(currentData, selectedVariable, binCount);

}

 

/**

 * Analyzes data and prepares visualization

 * @param {Array} data - Input data

 * @param {string} selectedVariable - Selected analysis variable

 * @param {number} binCount - Number of histogram bins

 */

function analyzeData(data, selectedVariable, binCount) {

    // Convert to typed arrays for performance

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

 

    // Trim arrays if invalid values were found

    if (validCount < values.length) {

        values = values.subarray(0, validCount);

        flags = flags.subarray(0, validCount);

    }

 

    // Store data for global access

    window.chartData = {

        values,

        flags,

        selectedVariable,

        binCount,

        initialDomain: [d3.min(values), d3.max(values)]

    };

 

    // Update scales

    xScale.domain(window.chartData.initialDomain).nice();

 

    // Update axes

    xAxis.call(d3.axisBottom(xScale));

    yAxis.call(d3.axisLeft(yScale));

 

    // Render chart

    updateChart(xScale);

}

 

/**

 * Updates chart visualization

 * @param {d3.scale} xScale - Current x-scale

 */

function updateChart(xScale) {

    const { values, flags, selectedVariable, binCount } = window.chartData;

    const domain = xScale.domain();

 

    // Animate x-axis transition

    xAxis.transition()

        .duration(750)

        .call(d3.axisBottom(xScale));

 

    // Create histogram bins

    const histogram = d3.histogram()

        .value(d => d)

        .domain(domain)

        .thresholds(binCount);

 

    const bins = histogram(values);

 

    // Calculate bin statistics

    const binsWithStats = bins.map(bin => {

        const startIdx = bin.x0 === domain[0] ? 0 :

            d3.bisectLeft(values, bin.x0);

        const endIdx = bin.x1 === domain[1] ? values.length :

            d3.bisectLeft(values, bin.x1);

 

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

 

    currentBins = binsWithStats;

 

    // Calculate linear regression if enough bins exist

    currentRegression = binsWithStats.length >= 2 ?

        linearRegression(binsWithStats.map(bin => ({

            x: bin.xMid,

            y: bin.fraudRatio

        }))) :

        null;

 

    // Set y-axis domain with padding

    const maxBarValue = d3.max(binsWithStats, d => d.fraudRatio);

    const maxTrendValue = currentRegression ?

        Math.max(

            currentRegression.slope * domain[0] + currentRegression.intercept,

            currentRegression.slope * domain[1] + currentRegression.intercept

        ) : 0;

 

    const maxYValue = Math.max(maxBarValue, maxTrendValue) * 1.1;

    yScale.domain([0, maxYValue]);

 

    // Render chart components

    drawBars(binsWithStats);

    drawTrendLine(domain);

    drawAxesAndGrid();

    drawTitle(selectedVariable, binsWithStats.length);

}

 

/**

 * Renders histogram bars with transitions

 * @param {Array} binsWithStats - Bin data with statistics

 */

function drawBars(binsWithStats) {

    // Data join with existing elements

    const bars = barsGroup.selectAll('.bar')

        .data(binsWithStats, d => d.x0);

 

    // Handle exiting bars

    bars.exit()

        .transition()

        .duration(250)

        .attr('y', height)

        .attr('height', 0)

        .remove();

 

    // Update existing bars

    bars.transition()

        .duration(1000)

        .attr('x', d => xScale(d.x0))

        .attr('width', d => Math.max(1, xScale(d.x1) - xScale(d.x0) - 1))

        .attr('y', d => yScale(d.fraudRatio))

        .attr('height', d => height - yScale(d.fraudRatio))

        .attr('fill', 'var(--tu-orange)');

 

    // Add new bars with animation

    bars.enter()

        .append('rect')

        .attr('class', 'bar')

        .attr('x', d => xScale(d.x0))

        .attr('width', d => Math.max(1, xScale(d.x1) - xScale(d.x0) - 1))

        .attr('y', height)

        .attr('height', 0)

        .attr('fill', 'var(--tu-orange)')

        .attr('rx', 2)

        .attr('ry', 2)

        .transition()

        .duration(750)

        .attr('y', d => yScale(d.fraudRatio))

        .attr('height', d => height - yScale(d.fraudRatio));

 

    // Update interactive areas for tooltips

    updateHitAreas(binsWithStats);

}

 

/**

 * Draws trend line based on regression

 * @param {Array} domain - Current x-domain

 */

function drawTrendLine(domain) {

    if (!currentRegression) {

        trendGroup.selectAll('.trend-line, .trend-value').remove();

        return;

    }

 

    const lineGenerator = d3.line()

        .x(d => xScale(d.x))

        .y(d => yScale(currentRegression.slope * d.x + currentRegression.intercept));

 

    const trendData = [

        { x: domain[0], y: currentRegression.slope * domain[0] + currentRegression.intercept },

        { x: domain[1], y: currentRegression.slope * domain[1] + currentRegression.intercept }

    ];

 

    // Update trend line

    const trendLine = trendGroup.selectAll('.trend-line')

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

 

    // Add trend value label

    const lastPoint = trendData[1];

    const trendLabel = trendGroup.selectAll('.trend-value')

        .data([lastPoint]);

 

    trendLabel.enter()

        .append('text')

        .attr('class', 'trend-value')

        .attr('x', xScale(lastPoint.x) - 5)

        .attr('y', yScale(lastPoint.y) - 5)

        .attr('text-anchor', 'end')

        .style('font-size', '10px')

        .style('font-weight', 'bold')

        .style('fill', 'var(--tu-blue)')

        .text(`${d3.format('.2f')(lastPoint.y)}x`);

 

    trendLabel.exit().remove();

}

 

/**

 * Updates interactive hit areas for tooltips

 * @param {Array} binsWithStats - Bin data with statistics

 */

function updateHitAreas(binsWithStats) {

    const hitAreas = chartGroup.selectAll('.bar-hit-area')

        .data(binsWithStats, d => d.x0);

 

    hitAreas.exit().remove();

 

    hitAreas.enter()

        .append('rect')

        .attr('class', 'bar-hit-area')

        .attr('x', d => xScale(d.x0))

        .attr('width', d => Math.max(1, xScale(d.x1) - xScale(d.x0) - 1))

        .attr('y', 0)

        .attr('height', height)

        .attr('opacity', 0)

        .on('mouseover', showTooltip)

        .on('mouseout', hideTooltip);

}

 

/**

 * Draws axes and grid lines

 */

function drawAxesAndGrid() {

    // Update y-axis with transition

    yAxis.transition()

        .duration(750)

        .call(d3.axisLeft(yScale).tickFormat(d => d3.format('.1f')(d)));

 

    // Update grid lines

    const grid = svg.selectAll('.grid').data([null]);

 

    grid.enter()

        .append('g')

        .attr('class', 'grid')

        .merge(grid)

        .transition()

        .duration(750)

        .call(d3.axisLeft(yScale))

        .call(g => g.select('.domain').remove())

        .call(g => g.selectAll('.tick line').clone()

            .attr('x2', width)

            .attr('stroke-opacity', 0.1));

 

    grid.exit().remove();

}

 

/**

 * Draws chart title

 * @param {string} selectedVariable - Current selected variable

 * @param {number} binCount - Current bin count

 */

function drawTitle(selectedVariable, binCount) {

    const title = svg.selectAll('.title').data([null]);

 

    title.enter()

        .append('text')

        .attr('class', 'title')

        .attr('x', width / 2)

        .attr('y', -10)

        .attr('text-anchor', 'middle')

        .style('font-size', '16px')

        .style('font-weight', 'bold')

        .style('fill', 'var(--tu-blue)')

        .merge(title)

        .text(`Fraud Ratio (vs. Average) by ${selectedVariable} (${binCount} bins)`);

 

    title.exit().remove();

}

 

/**

 * Shows tooltip on mouseover

 * @param {Event} event - Mouse event

 * @param {Object} d - Data for hovered bin

 */

function showTooltip(event, d) {

    const tooltip = d3.select('#tooltip');

    tooltip.transition().duration(200).style('opacity', 0.9);

 

    const expectedValue = currentRegression ?

        currentRegression.slope * d.xMid + currentRegression.intercept : null;

 

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

 

/**

 * Hides tooltip

 */

function hideTooltip() {

    d3.select('#tooltip').transition().duration(500).style('opacity', 0);

}

 

/**

 * Calculates linear regression

 * @param {Array} data - Array of {x, y} points

 * @returns {Object} - Regression parameters {slope, intercept}

 */

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

 

/**

 * Handles brush end event for zooming

 * @param {Event} event - Brush event

 */

function brushed(event) {

    const selection = event.selection;

 

    if (!selection) {

        if (!idleTimeout) return idleTimeout = setTimeout(idled, 350);

        xScale.domain(window.chartData.initialDomain);

        isZoomed = false;

    } else {

        xScale.domain([xScale.invert(selection[0]), xScale.invert(selection[1])]);

        svg.select(".brush").call(brush.move, null);

        isZoomed = true;

    }

 

    updateChart(xScale);

}

 

/**

 * Handles idle state after brush

 */

function idled() {

    idleTimeout = null;

}


/**

 * Resets zoom to initial domain

 */

function resetZoom() {

    if (!window.chartData) return;

    xScale.domain(window.chartData.initialDomain);

    isZoomed = false;

    updateChart(xScale);

}