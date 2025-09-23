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
            'dot': this.drawDotPlot.bind(this)
        };
    }

    drawChart(chartId, chart) {
        if (!chart || !chart.currentBins) return;
        
        const chartElement = document.getElementById(chartId);
        const chartTypeSelect = chartElement.querySelector('.chart-type-select');
        const chartType = chartTypeSelect ? chartTypeSelect.value : 'histogram';
        
        // Clear existing chart elements
        chart.barsGroup.selectAll('*').remove();
        
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
}