// merge-manager.js
class MergeManager {
    showModal(charts, datasets) {
        const modal = document.getElementById('join-modal');
        const chartsList = modal.querySelector('.charts-list');
        
        chartsList.innerHTML = '';
        
        const visibleCharts = charts.filter(chart => 
            document.getElementById(chart.containerId.replace('chart-', '')) && chart.chartData
        );
        
        if (visibleCharts.length < 2) {
            alert('At least 2 charts with data are required to merge');
            return;
        }
        
        visibleCharts.forEach((chart, index) => {
            const title = chart.chartData.selectedVariable || 'No variable';
            const datasetName = datasets[chart.datasetIndex]?.name || 'No dataset';
            
            const item = document.createElement('div');
            item.className = 'join-chart-item';
            item.innerHTML = `
                <input type="checkbox" id="join-chart-${index}" value="${chart.containerId}">
                <label for="join-chart-${index}">${title} (${datasetName})</label>
            `;
            chartsList.appendChild(item);
        });
        
        modal.style.display = 'flex';
        
        document.getElementById('confirm-join').onclick = () => {
            const selectedCharts = [];
            chartsList.querySelectorAll('input:checked').forEach(checkbox => {
                selectedCharts.push(checkbox.value);
            });
            
            if (selectedCharts.length !== 2) {
                alert('Please select exactly 2 charts to merge');
                return;
            }
            
            const chart1 = charts.find(c => c.containerId === selectedCharts[0]);
            const chart2 = charts.find(c => c.containerId === selectedCharts[1]);
            
            if (!chart1 || !chart2 || !chart1.chartData || !chart2.chartData) {
                alert('Error finding selected charts or charts have no data');
                return;
            }
            
            if (chart1.chartData.selectedVariable !== chart2.chartData.selectedVariable) {
                alert('Charts must have the same feature to be merged');
                return;
            }
            
            this.mergeCharts(chart1, chart2, datasets);
            modal.style.display = 'none';
        };
        
        document.getElementById('cancel-join').onclick = () => {
            modal.style.display = 'none';
        };
    }

    mergeCharts(chart1, chart2, datasets) {
        const chartId = `chart-merged-${Date.now()}`;
        const chartsGrid = document.getElementById('charts-grid');
        
        const chartWrapper = this.createMergedChartDOM(chartId, chart1.chartData.selectedVariable);
        chartsGrid.appendChild(chartWrapper);
        
        const chart = window.app.chartManager.initializeD3Chart(chartId);
        
        const color1 = this.getChartColor(chart1.containerId.replace('chart-', ''));
        const color2 = this.getChartColor(chart2.containerId.replace('chart-', ''));
        
        chart.chartData = {
            selectedVariable: chart1.chartData.selectedVariable,
            binCount: Math.max(chart1.chartData.binCount, chart2.chartData.binCount),
            sourceData: [
                { 
                    dataset: datasets[chart1.datasetIndex].name, 
                    color: color1,
                    index: 0,
                    values: chart1.chartData.values,
                    flags: chart1.chartData.flags
                },
                { 
                    dataset: datasets[chart2.datasetIndex].name, 
                    color: color2,
                    index: 1,
                    values: chart2.chartData.values,
                    flags: chart2.chartData.flags
                }
            ]
        };
        
        const allValues = [...chart1.chartData.values, ...chart2.chartData.values];
        chart.chartData.initialDomain = [d3.min(allValues), d3.max(allValues)];
        
        chart.xScale.domain(chart.chartData.initialDomain).nice();
        chart.yScale.domain([0, 1]).nice();
        
        window.app.chartManager.charts.push(chart);
        this.updateMergedChart(chart);
        this.addLegend(chartWrapper, chart.chartData.sourceData);
        
        setTimeout(() => {
            window.app.chartManager.handleResize();
        }, 10);
    }

    createMergedChartDOM(chartId, variableName) {
        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'chart-wrapper';
        chartWrapper.id = chartId;
        
        const chartHeader = document.createElement('div');
        chartHeader.className = 'chart-header';
        
        const chartTitle = document.createElement('h3');
        chartTitle.className = 'chart-title';
        chartTitle.textContent = `Merged: ${variableName}`;
        
        const chartControls = document.createElement('div');
        chartControls.className = 'chart-controls';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-chart';
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => window.app.chartManager.removeChart(chartId);
        chartControls.appendChild(removeBtn);
        
        chartHeader.appendChild(chartTitle);
        chartHeader.appendChild(chartControls);
        
        const chartDiv = document.createElement('div');
        chartDiv.className = 'chart';
        chartDiv.id = `chart-${chartId}`;
        
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.style.opacity = '0';
        tooltip.id = `tooltip-${chartId}`;
        
        chartWrapper.appendChild(chartHeader);
        chartWrapper.appendChild(chartDiv);
        chartWrapper.appendChild(tooltip);
        
        return chartWrapper;
    }

    updateMergedChart(chart) {
        if (!chart || !chart.chartData) return;
        
        const { sourceData, binCount } = chart.chartData;
        const domain = chart.xScale.domain();
        
        const histogram = d3.histogram()
            .value(d => d)
            .domain(domain)
            .thresholds(binCount);
        
        const datasetsWithBins = sourceData.map(source => {
            const bins = histogram(source.values);
            
            const binsWithStats = bins.map(bin => {
                const startIdx = bin.x0 === domain[0] ? 0 : d3.bisectLeft(source.values, bin.x0);
                const endIdx = bin.x1 === domain[1] ? source.values.length : d3.bisectLeft(source.values, bin.x1);
                
                let fraudCount = 0;
                for (let i = startIdx; i < endIdx; i++) {
                    fraudCount += source.flags[i];
                }
                
                const total = endIdx - startIdx;
                const fraudRate = total > 0 ? fraudCount / total : 0;
                const totalFraudRate = d3.mean(source.flags);
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
            
            return {
                ...source,
                bins: binsWithStats
            };
        });
        
        chart.currentBins = datasetsWithBins;
        
        const maxBarValue = d3.max(datasetsWithBins.flatMap(d => d.bins), d => d.fraudRatio) * 1.1;
        chart.yScale.domain([0, maxBarValue || 1]);
        
        this.drawMergedBars(datasetsWithBins, chart);
        window.app.chartManager.drawAxesAndGrid(chart.containerId.replace('chart-', ''));
        
        chart.xAxis.transition()
            .duration(750)
            .call(d3.axisBottom(chart.xScale));
            
        chart.yAxis.transition()
            .duration(750)
            .call(d3.axisLeft(chart.yScale).tickFormat(d => d3.format('.1f')(d)));
    }

    drawMergedBars(datasetsWithBins, chart) {
        const barsGroup = chart.barsGroup;
        barsGroup.selectAll('.bar').remove();
        
        datasetsWithBins.forEach((dataset, datasetIndex) => {
            const barColor = dataset.color;
            
            barsGroup.selectAll(`.bar-source-${datasetIndex}`)
                .data(dataset.bins)
                .enter()
                .append('rect')
                .attr('class', `bar bar-source-${datasetIndex}`)
                .attr('x', d => chart.xScale(d.x0))
                .attr('width', d => Math.max(1, chart.xScale(d.x1) - chart.xScale(d.x0) - 1))
                .attr('y', d => chart.yScale(d.fraudRatio))
                .attr('height', d => chart.height - chart.yScale(d.fraudRatio))
                .attr('fill', barColor)
                .attr('opacity', 0.7)
                .attr('rx', 2)
                .attr('ry', 2);
        });
    }

    addLegend(chartWrapper, sourceData) {
        const existingLegend = chartWrapper.querySelector('.legend');
        if (existingLegend) {
            existingLegend.remove();
        }
        
        const legend = document.createElement('div');
        legend.className = 'legend';
        
        sourceData.forEach(source => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = source.color;
            
            const label = document.createElement('span');
            label.textContent = source.dataset;
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(label);
            legend.appendChild(legendItem);
        });
        
        chartWrapper.querySelector('.chart-header').appendChild(legend);
    }

    getChartColor(chartId) {
        const chartElement = document.getElementById(chartId);
        if (!chartElement) return '#F68D2E';
        
        const colorPicker = chartElement.querySelector('.color-picker-input');
        return colorPicker ? colorPicker.value : '#F68D2E';
    }
}