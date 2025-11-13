// chart-types.js
class ChartRenderer {
    constructor() {
        this.chartTypes = {
            'histogram': this.drawHistogram.bind(this),
            'line': this.drawLineChart.bind(this),
            'area': this.drawAreaChart.bind(this),
            'scatter': this.drawScatterPlot.bind(this),
            'bar-horizontal': this.drawHorizontalBars.bind(this),
            'smooth-line': this.drawSmoothLineChart.bind(this),
            'step': this.drawStepChart.bind(this),
            'dot': this.drawDotPlot.bind(this),
            'compare-histogram': this.drawCompareHistogram.bind(this),
            'outlier-detection': this.drawOutlierDetection.bind(this)
        };
    }

    drawChart(chartId, chart) {
        if (!chart) return;
        
        const chartElement = document.getElementById(chartId);
        const chartTypeSelect = chartElement.querySelector('.chart-type-select');
        const chartType = chartTypeSelect ? chartTypeSelect.value : 'histogram';
        
        // Clear existing chart elements
        chart.barsGroup.selectAll('*').remove();
        
        // For comparison charts, we need compareData
        if (chartType === 'compare-histogram') {
            if (!chart.compareData) {
                console.error('No comparison data available');
                return;
            }
            this.drawCompareHistogram(chartId, chart);
            return;
        }
        
        // For regular charts, we need currentBins
        if (!chart.currentBins) return;
        
        const renderFunction = this.chartTypes[chartType];
        if (renderFunction) {
            renderFunction(chartId, chart);
        } else {
            this.drawHistogram(chartId, chart); // Default fallback
        }
        
        this.setupChartInteractions(chartId, chart);
    }

    drawHistogram(chartId, chart) {
        const color = this.getChartColor(chartId);
        const binsWithStats = chart.currentBins;

        const bars = chart.barsGroup.selectAll('.bar')
            .data(binsWithStats, d => d.x0);

        // Exit
        bars.exit()
            .transition()
            .duration(250)
            .attr('y', chart.height)
            .attr('height', 0)
            .remove();

        // Update
        bars.transition()
            .duration(750)
            .attr('x', d => chart.xScale(d.x0))
            .attr('width', d => Math.max(1, chart.xScale(d.x1) - chart.xScale(d.x0) - 1))
            .attr('y', d => chart.yScale(d.fraudRatio))
            .attr('height', d => chart.height - chart.yScale(d.fraudRatio))
            .attr('fill', color);

        // Enter
        bars.enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => chart.xScale(d.x0))
            .attr('width', d => Math.max(1, chart.xScale(d.x1) - chart.xScale(d.x0) - 1))
            .attr('y', chart.height)
            .attr('height', 0)
            .attr('fill', color)
            .attr('rx', 2)
            .attr('ry', 2)
            .transition()
            .duration(750)
            .attr('y', d => chart.yScale(d.fraudRatio))
            .attr('height', d => chart.height - chart.yScale(d.fraudRatio));
    }

    drawLineChart(chartId, chart) {
        const color = this.getChartColor(chartId);
        const binsWithStats = chart.currentBins;

        const lineGenerator = d3.line()
            .x(d => chart.xScale(d.xMid))
            .y(d => chart.yScale(d.fraudRatio))
            .curve(d3.curveLinear);

        chart.barsGroup.append('path')
            .datum(binsWithStats)
            .attr('class', 'line-chart')
            .attr('d', lineGenerator)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 3)
            .attr('opacity', 0.8);

        // Add points at each data point
        chart.barsGroup.selectAll('.line-point')
            .data(binsWithStats)
            .enter()
            .append('circle')
            .attr('class', 'line-point')
            .attr('cx', d => chart.xScale(d.xMid))
            .attr('cy', d => chart.yScale(d.fraudRatio))
            .attr('r', 3)
            .attr('fill', color)
            .attr('opacity', 0.8);
    }

    drawSmoothLineChart(chartId, chart) {
        const color = this.getChartColor(chartId);
        const binsWithStats = chart.currentBins;

        const lineGenerator = d3.line()
            .x(d => chart.xScale(d.xMid))
            .y(d => chart.yScale(d.fraudRatio))
            .curve(d3.curveMonotoneX);

        chart.barsGroup.append('path')
            .datum(binsWithStats)
            .attr('class', 'smooth-line')
            .attr('d', lineGenerator)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 3)
            .attr('opacity', 0.8);
    }

    drawStepChart(chartId, chart) {
        const color = this.getChartColor(chartId);
        const binsWithStats = chart.currentBins;

        const lineGenerator = d3.line()
            .x(d => chart.xScale(d.xMid))
            .y(d => chart.yScale(d.fraudRatio))
            .curve(d3.curveStepAfter);

        chart.barsGroup.append('path')
            .datum(binsWithStats)
            .attr('class', 'step-chart')
            .attr('d', lineGenerator)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 2)
            .attr('opacity', 0.8);
    }

    drawAreaChart(chartId, chart) {
        const color = this.getChartColor(chartId);
        const binsWithStats = chart.currentBins;

        const areaGenerator = d3.area()
            .x(d => chart.xScale(d.xMid))
            .y0(chart.height)
            .y1(d => chart.yScale(d.fraudRatio))
            .curve(d3.curveMonotoneX);

        chart.barsGroup.append('path')
            .datum(binsWithStats)
            .attr('class', 'area-chart')
            .attr('d', areaGenerator)
            .attr('fill', color)
            .attr('opacity', 0.5)
            .attr('stroke', color)
            .attr('stroke-width', 1);
    }

    drawScatterPlot(chartId, chart) {
        const color = this.getChartColor(chartId);
        const binsWithStats = chart.currentBins;

        chart.barsGroup.selectAll('.scatter-point')
            .data(binsWithStats)
            .enter()
            .append('circle')
            .attr('class', 'scatter-point')
            .attr('cx', d => chart.xScale(d.xMid))
            .attr('cy', d => chart.yScale(d.fraudRatio))
            .attr('r', 5)
            .attr('fill', color)
            .attr('opacity', 0.7)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1);
    }

    drawDotPlot(chartId, chart) {
        const color = this.getChartColor(chartId);
        const binsWithStats = chart.currentBins;

        chart.barsGroup.selectAll('.dot-plot-point')
            .data(binsWithStats)
            .enter()
            .append('circle')
            .attr('class', 'dot-plot-point')
            .attr('cx', d => chart.xScale(d.xMid))
            .attr('cy', d => chart.yScale(d.fraudRatio))
            .attr('r', 4)
            .attr('fill', color)
            .attr('opacity', 0.7);
    }

    drawHorizontalBars(chartId, chart) {
        const color = this.getChartColor(chartId);
        const binsWithStats = chart.currentBins;
        
        // Sort bins by value for better horizontal display
        const sortedBins = [...binsWithStats].sort((a, b) => a.fraudRatio - b.fraudRatio);
        const barHeight = Math.max(10, (chart.height / sortedBins.length) * 0.8);

        const bars = chart.barsGroup.selectAll('.horizontal-bar')
            .data(sortedBins);

        // Exit
        bars.exit()
            .transition()
            .duration(250)
            .attr('width', 0)
            .remove();

        // Update
        bars.transition()
            .duration(750)
            .attr('y', (d, i) => i * (chart.height / sortedBins.length))
            .attr('width', d => chart.xScale(d.fraudRatio))
            .attr('height', barHeight)
            .attr('fill', color);

        // Enter
        bars.enter()
            .append('rect')
            .attr('class', 'horizontal-bar')
            .attr('x', 0)
            .attr('y', (d, i) => i * (chart.height / sortedBins.length))
            .attr('width', 0)
            .attr('height', barHeight)
            .attr('fill', color)
            .attr('rx', 2)
            .attr('ry', 2)
            .transition()
            .duration(750)
            .attr('width', d => chart.xScale(d.fraudRatio));

        // Add labels for horizontal bars
        chart.barsGroup.selectAll('.bar-label')
            .data(sortedBins)
            .enter()
            .append('text')
            .attr('class', 'bar-label')
            .attr('x', d => chart.xScale(d.fraudRatio) + 5)
            .attr('y', (d, i) => i * (chart.height / sortedBins.length) + barHeight / 2)
            .attr('dy', '0.35em')
            .attr('font-size', '10px')
            .attr('fill', '#333')
            .text(d => d3.format('.2f')(d.fraudRatio));
    }

    setupChartInteractions(chartId, chart) {
        const tooltip = d3.select(`#tooltip-${chartId}`);
        console.log("setupChartInteractions")
        // Add mouse events for interactive elements
        chart.barsGroup.selectAll('rect, circle, path')
            .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity', 0.9);
                this.showTooltip(event, d, chartId, chart);
            }.bind(this))
            .on('mouseout', function() {
                d3.select(this).attr('opacity', null);
                this.hideTooltip(chartId);
            }.bind(this))
            .on('mousemove', function(event, d) {
                this.showTooltip(event, d, chartId, chart);
            }.bind(this));
    }

    showTooltip(event, d, chartId, chart) {
        console.log(event)
        const tooltip = d3.select(`#tooltip-${chartId}`);
        
        const expectedValue = chart.currentRegression ?
            chart.currentRegression.slope * d.xMid + chart.currentRegression.intercept : null;

        const tooltipHtml = `
            <div><strong>Range:</strong> ${d3.format(',')(d.x0)} - ${d3.format(',')(d.x1)}</div>
            <div><strong>Fraud Ratio:</strong> ${d3.format('.2f')(d.fraudRatio)}x</div>
            ${expectedValue ? `
            <div><strong>Expected Trend:</strong> ${d3.format('.2f')(expectedValue)}x</div>
            <div><strong>Deviation:</strong> ${d3.format('+.2f')(d.fraudRatio - expectedValue)}x</div>
            ` : ''}
            <div><strong>Fraud Rate:</strong> ${d3.format('.1%')(d.fraudRate)}</div>
            <div><strong>Transactions:</strong> ${d.count.toLocaleString()}</div>
        `;

        tooltip
            .html(tooltipHtml)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 20}px`)
            .transition()
            .duration(200)
            .style('opacity', 0.9);
    }

    hideTooltip(chartId) {
        d3.select(`#tooltip-${chartId}`)
            .transition()
            .duration(500)
            .style('opacity', 0);
    }

    getChartColor(chartId) {
        const chartElement = document.getElementById(chartId);
        if (!chartElement) return '#F68D2E';
        
        const colorPicker = chartElement.querySelector('.color-picker-input');
        return colorPicker ? colorPicker.value : '#F68D2E';
    }
 
    drawCompareHistogram(chartId, chart) {
        if (!chart.compareData || !chart.compareData.series1 || !chart.compareData.series2) {
            console.error('Comparative data not available');
            return;
        }

        // Clear existing elements including trend line
        chart.barsGroup.selectAll('*').remove();
        chart.trendGroup.selectAll('*').remove(); // Clear trend line

        const { series1, series2, ksStat, pValue, variableName } = chart.compareData;
        
        // Get colors from the dynamic color pickers
        const chartElement = document.getElementById(chartId);
        const colorPicker1 = chartElement ? chartElement.querySelector('.color-picker-1') : null;
        const colorPicker2 = chartElement ? chartElement.querySelector('.color-picker-2') : null;
        
        const color1 = colorPicker1 ? colorPicker1.value : '#ff6b6b';
        const color2 = colorPicker2 ? colorPicker2.value : '#4ecdc4';

        // Configure scales
        const xScale = chart.xScale;
        const allValues = [...series1, ...series2];
        const domain = [d3.min(allValues), d3.max(allValues)];
        xScale.domain(domain);

        // Create histograms for density calculation
        const histogram = d3.histogram()
            .domain(xScale.domain())
            .thresholds(xScale.ticks(30));

        const bins1 = histogram(series1);
        const bins2 = histogram(series2);

        // Calculate densities
        const density1 = bins1.map(bin => ({
            x0: bin.x0,
            x1: bin.x1,
            xMid: (bin.x0 + bin.x1) / 2,
            density: bin.length / series1.length
        }));

        const density2 = bins2.map(bin => ({
            x0: bin.x0,
            x1: bin.x1,
            xMid: (bin.x0 + bin.x1) / 2,
            density: bin.length / series2.length
        }));

        // Find maximum density for Y axis scaling
        const maxDensity1 = d3.max(density1, d => d.density);
        const maxDensity2 = d3.max(density2, d => d.density);
        const maxDensity = Math.max(maxDensity1, maxDensity2) * 1.1;

        // Set Y scale for density
        chart.yScale.domain([0, maxDensity]);

        // Draw density bars for series1 (fraud=1)
        chart.barsGroup.selectAll('.density-bar-1')
            .data(density1)
            .enter()
            .append('rect')
            .attr('class', 'density-bar density-bar-1')
            .attr('x', d => xScale(d.x0))
            .attr('width', d => Math.max(1, xScale(d.x1) - xScale(d.x0) - 1))
            .attr('y', d => chart.yScale(d.density))
            .attr('height', d => chart.height - chart.yScale(d.density))
            .attr('fill', color1)
            .attr('opacity', 0.6)
            .attr('rx', 2)
            .attr('ry', 2);

        // Draw density bars for series2 (fraud=0)
        chart.barsGroup.selectAll('.density-bar-2')
            .data(density2)
            .enter()
            .append('rect')
            .attr('class', 'density-bar density-bar-2')
            .attr('x', d => xScale(d.x0))
            .attr('width', d => Math.max(1, xScale(d.x1) - xScale(d.x0) - 1))
            .attr('y', d => chart.yScale(d.density))
            .attr('height', d => chart.height - chart.yScale(d.density))
            .attr('fill', color2)
            .attr('opacity', 0.6)
            .attr('rx', 2)
            .attr('ry', 2);

        // Add density lines (KDE)
        this.drawDensityLine(chartId, chart, series1, color1, 'density-line-1', '5,5');
        this.drawDensityLine(chartId, chart, series2, color2, 'density-line-2', 'none');

        // Add KS info and legend
        this.addCompareLegend(chartId, chart, color1, color2);

        // Update axes
        this.updateCompareAxes(chartId, chart);
    }

    drawDensityLine(chartId, chart, data, color, className, dashArray) {
        // Kernel Density Estimation for smooth density lines
        const bandwidth = 0.1;
        const xScale = chart.xScale;
        const yScale = chart.yScale;
        
        const xValues = d3.range(xScale.domain()[0], xScale.domain()[1], 
                                (xScale.domain()[1] - xScale.domain()[0]) / 100);
        
        const densities = xValues.map(x => {
            let density = 0;
            data.forEach(d => {
                density += this.gaussianKernel((x - d) / bandwidth);
            });
            return { x, y: density / (data.length * bandwidth) };
        });

        const line = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y))
            .curve(d3.curveBasis);

        chart.barsGroup.append('path')
            .datum(densities)
            .attr('class', className)
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', dashArray)
            .attr('opacity', 0.8);
    }

    updateCompareAxes(chartId, chart) {
        // Update X axis
        chart.xAxis
            .transition()
            .duration(750)
            .call(d3.axisBottom(chart.xScale));

        // Update Y axis for density
        chart.yAxis
            .transition()
            .duration(750)
            .call(d3.axisLeft(chart.yScale).tickFormat(d3.format('.3f')));

        // Add axis labels
        chart.svg.selectAll('.axis-label').remove();
        
        // X axis label
        chart.svg.append('text')
            .attr('class', 'axis-label')
            .attr('x', chart.width / 2)
            .attr('y', chart.height + 40)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Feature Value');

        // Y axis label
        chart.svg.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', -40)
            .attr('x', -chart.height / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Density');
    }

    gaussianKernel(u) {
        return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * u * u);
    }

    addKSInfo(chartId, chart, ksStat, pValue) {
        
        chart.barsGroup.selectAll('.ks-statistic').remove();
        
        
        const yPosition = Math.max(-25, -chart.height * 0.05);
        
        
        const chartHeightThreshold = 400;
        let ksText;
        
        if (chart.height < chartHeightThreshold) {
            ksText = [
                `KS = ${ksStat.toFixed(4)}`,
                `p = ${pValue.toExponential(2)}`
            ];
        } else {
            ksText = [`KS = ${ksStat.toFixed(4)} ; p = ${pValue.toExponential(2)}`];
        }
        
        
        ksText.forEach((text, index) => {
            chart.barsGroup.append('text')
                .attr('class', 'ks-statistic')
                .attr('x', chart.width / 2)
                .attr('y', yPosition + (index * 14))
                .attr('text-anchor', 'middle')
                .style('font-size', chart.height < 400 ? '10px' : '12px')
                .style('font-weight', 'bold')
                .style('fill', '#333')
                .text(text);
        });
    }

    addCompareLegend(chartId, chart, color1, color2) {
        // Clear existing legend
        chart.barsGroup.selectAll('.legend-group').remove();

        // Create legend group
        const legendGroup = chart.barsGroup.append('g')
            .attr('class', 'legend-group')
            .attr('transform', `translate(${chart.width - 180}, 20)`);

        // Legend title
        legendGroup.append('text')
            .attr('class', 'legend-title')
            .attr('x', 0)
            .attr('y', 0)
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('fill', '#333')
            .text('Distribution:');

        // Fraud=1 legend item - LINE ONLY
        const legend1 = legendGroup.append('g')
            .attr('class', 'legend-item')
            .attr('transform', 'translate(0, 20)');

        legend1.append('line')
            .attr('class', 'legend-color-1')
            .attr('x1', 0)
            .attr('x2', 15)
            .attr('y1', 0)
            .attr('y2', 0)
            .attr('stroke', color1)
            .attr('stroke-width', 3)
            .attr('stroke-dasharray', '5,5');

        legend1.append('text')
            .attr('x', 20)
            .attr('y', 0)
            .attr('dy', '0.35em')
            .style('font-size', '11px')
            .style('fill', '#333')
            .text('fraud = 1');

        // Fraud=0 legend item - LINE ONLY
        const legend2 = legendGroup.append('g')
            .attr('class', 'legend-item')
            .attr('transform', 'translate(0, 40)');

        legend2.append('line')
            .attr('class', 'legend-color-2')
            .attr('x1', 0)
            .attr('x2', 15)
            .attr('y1', 0)
            .attr('y2', 0)
            .attr('stroke', color2)
            .attr('stroke-width', 3)
            .attr('stroke-dasharray', 'none');

        legend2.append('text')
            .attr('x', 20)
            .attr('y', 0)
            .attr('dy', '0.35em')
            .style('font-size', '11px')
            .style('fill', '#333')
            .text('fraud = 0');
    }

    //outlier chart
    drawOutlierDetection(chartId, chart) {
        if (!chart.outlierData) {
            console.error('No outlier data available');
            return;
        }

        // Clear existing elements
        chart.barsGroup.selectAll('*').remove();

        const { outliers, nonOutliers, bounds, variableName } = chart.outlierData;
        
        // Get colors
        const chartElement = document.getElementById(chartId);
        const colorPicker = chartElement ? chartElement.querySelector('.color-picker-input') : null;
        const mainColor = colorPicker ? colorPicker.value : '#F68D2E';
        const outlierColor = '#ff4444';
        const nonOutlierColor = '#4ecdc4';

        // Configure scales
        const allValues = [...outliers, ...nonOutliers].map(d => d.value);
        const domain = [d3.min(allValues), d3.max(allValues)];
        chart.xScale.domain(domain);
        
        // Use the entire height for the strip plot
        const padding = 20;
        const stripHeight = Math.max(10, (chart.height - 2 * padding) / allValues.length);

        // Draw non-outliers first
        chart.barsGroup.selectAll('.non-outlier')
            .data(nonOutliers)
            .enter()
            .append('circle')
            .attr('class', 'non-outlier')
            .attr('cx', d => chart.xScale(d.value))
            .attr('cy', (d, i) => padding + i * stripHeight)
            .attr('r', 3)
            .attr('fill', nonOutlierColor)
            .attr('opacity', 0.7)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1);

        // Draw outliers
        chart.barsGroup.selectAll('.outlier-point')
            .data(outliers)
            .enter()
            .append('circle')
            .attr('class', 'outlier-point')
            .attr('cx', d => chart.xScale(d.value))
            .attr('cy', (d, i) => padding + (nonOutliers.length + i) * stripHeight)
            .attr('r', 5)
            .attr('fill', outlierColor)
            .attr('opacity', 0.9)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

        // Draw bounds lines
        chart.barsGroup.append('line')
            .attr('class', 'bound-line')
            .attr('x1', chart.xScale(bounds.lower))
            .attr('x2', chart.xScale(bounds.lower))
            .attr('y1', 0)
            .attr('y2', chart.height)
            .attr('stroke', '#ff6b6b')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5')
            .attr('opacity', 0.7);

        chart.barsGroup.append('line')
            .attr('class', 'bound-line')
            .attr('x1', chart.xScale(bounds.upper))
            .attr('x2', chart.xScale(bounds.upper))
            .attr('y1', 0)
            .attr('y2', chart.height)
            .attr('stroke', '#ff6b6b')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5')
            .attr('opacity', 0.7);

        // Add bounds labels
        chart.barsGroup.append('text')
            .attr('class', 'bound-label')
            .attr('x', chart.xScale(bounds.lower))
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#ff6b6b')
            .style('font-weight', 'bold')
            .text(`Lower: ${bounds.lower.toFixed(2)}`);

        chart.barsGroup.append('text')
            .attr('class', 'bound-label')
            .attr('x', chart.xScale(bounds.upper))
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#ff6b6b')
            .style('font-weight', 'bold')
            .text(`Upper: ${bounds.upper.toFixed(2)}`);

        // Add statistics info
        this.addOutlierStatistics(chartId, chart);
        this.addOutlierLegend(chartId, chart, outlierColor, nonOutlierColor);

        // Update axes
        this.updateOutlierAxes(chartId, chart);
    }

    addOutlierStatistics(chartId, chart) {
        const { outliers, nonOutliers, bounds } = chart.outlierData;
        const totalPoints = outliers.length + nonOutliers.length;
        const outlierPercentage = (outliers.length / totalPoints * 100).toFixed(1);

        chart.barsGroup.append('text')
            .attr('class', 'outlier-stats')
            .attr('x', chart.width / 2)
            .attr('y', -20)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', '#333')
            .text(`Outliers: ${outliers.length}/${totalPoints} (${outlierPercentage}%)`);

        // Add IQR info
        chart.barsGroup.append('text')
            .attr('class', 'iqr-info')
            .attr('x', chart.width / 2)
            .attr('y', -5)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#666')
            .text(`IQR: [${bounds.q1.toFixed(2)}, ${bounds.q3.toFixed(2)}]`);
    }

    addOutlierLegend(chartId, chart, outlierColor, nonOutlierColor) {
        const legendGroup = chart.barsGroup.append('g')
            .attr('class', 'outlier-legend')
            .attr('transform', `translate(${chart.width - 150}, 20)`);

        // Legend title
        legendGroup.append('text')
            .attr('class', 'legend-title')
            .attr('x', 0)
            .attr('y', 0)
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('fill', '#333')
            .text('Points:');

        // Non-outlier legend
        const nonOutlierLegend = legendGroup.append('g')
            .attr('class', 'legend-item')
            .attr('transform', 'translate(0, 20)');

        nonOutlierLegend.append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 4)
            .attr('fill', nonOutlierColor)
            .attr('opacity', 0.7);

        nonOutlierLegend.append('text')
            .attr('x', 10)
            .attr('y', 0)
            .attr('dy', '0.35em')
            .style('font-size', '11px')
            .style('fill', '#333')
            .text('Normal');

        // Outlier legend
        const outlierLegend = legendGroup.append('g')
            .attr('class', 'legend-item')
            .attr('transform', 'translate(0, 40)');

        outlierLegend.append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 4)
            .attr('fill', outlierColor)
            .attr('opacity', 0.9);

        outlierLegend.append('text')
            .attr('x', 10)
            .attr('y', 0)
            .attr('dy', '0.35em')
            .style('font-size', '11px')
            .style('fill', '#333')
            .text('Outlier');
    }

    updateOutlierAxes(chartId, chart) {
        // Update X axis
        chart.xAxis
            .transition()
            .duration(750)
            .call(d3.axisBottom(chart.xScale));

        // Hide Y axis for outlier detection (it's just a strip plot)
        chart.yAxis
            .transition()
            .duration(750)
            .call(d3.axisLeft(chart.yScale).tickValues([]));

        // Add axis labels
        chart.svg.selectAll('.axis-label').remove();
        
        chart.svg.append('text')
            .attr('class', 'axis-label')
            .attr('x', chart.width / 2)
            .attr('y', chart.height + 40)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Feature Value');
    }
}