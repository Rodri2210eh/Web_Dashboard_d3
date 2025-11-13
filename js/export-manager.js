// export-manager.js
class ExportManager {
    showModal(charts) {
        const modal = document.getElementById('export-modal');
        const chartsList = modal.querySelector('.charts-list');
        
        chartsList.innerHTML = '';
        
        const visibleCharts = charts.filter(chart => 
            document.getElementById(chart.containerId.replace('chart-', ''))
        );
        
        if (visibleCharts.length === 0) {
            alert('No charts available to export');
            return;
        }
        
        visibleCharts.forEach((chart, index) => {
            const chartElement = document.getElementById(chart.containerId.replace('chart-', ''));
            const titleElement = chartElement ? chartElement.querySelector('.chart-title') : null;
            let title = 'Unnamed Chart';
            
            if (titleElement) {
                title = titleElement.textContent || titleElement.innerText || 'Unnamed Chart';
            } else if (chart.chartData?.selectedVariable) {
                title = `Analysis: ${chart.chartData.selectedVariable}`;
            }
            
            const item = document.createElement('div');
            item.className = 'chart-item';
            item.innerHTML = `
                <input type="checkbox" id="chart-${index}" checked>
                <label for="chart-${index}" class="chart-title">${title}</label>
            `;
            chartsList.appendChild(item);
        });
        
        modal.style.display = 'flex';
        
        document.getElementById('select-all').onclick = () => {
            chartsList.querySelectorAll('input').forEach(checkbox => {
                checkbox.checked = true;
            });
        };
        
        document.getElementById('export-selected').onclick = () => {
            const selectedIndices = [];
            chartsList.querySelectorAll('input').forEach((checkbox, index) => {
                if (checkbox.checked) {
                    selectedIndices.push(index);
                }
            });
            
            if (selectedIndices.length === 0) {
                alert('Please select at least one chart');
                return;
            }
            
            this.exportSelectedCharts(selectedIndices.map(i => visibleCharts[i]));
            modal.style.display = 'none';
        };
        
        document.getElementById('cancel-export').onclick = () => {
            modal.style.display = 'none';
        };
    }

    exportSelectedCharts(chartsToExport) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = 2;
        const padding = 25 * scale;
        const chartPadding = 15 * scale;
        
        let chartsPerRow;
        if (chartsToExport.length === 1) chartsPerRow = 1;
        else if (chartsToExport.length <= 4) chartsPerRow = 2;
        else chartsPerRow = 3;
        
        const firstChartId = chartsToExport[0].containerId.replace('chart-', '');
        const firstChartElement = document.getElementById(firstChartId);
        const firstSvg = firstChartElement.querySelector('svg');
        const chartWidth = firstSvg.clientWidth * scale;
        const chartHeight = firstSvg.clientHeight * scale;
        
        const cols = Math.min(chartsPerRow, chartsToExport.length);
        const rows = Math.ceil(chartsToExport.length / chartsPerRow);
        
        canvas.width = cols * chartWidth + (cols - 1) * chartPadding + 2 * padding;
        canvas.height = rows * (chartHeight + 60 * scale) + (rows - 1) * chartPadding + 2 * padding;
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'black';
        ctx.font = `bold ${16 * scale}px Arial`;
        ctx.fillText('Charts Export', padding, padding - 5 * scale);
        
        const promises = chartsToExport.map((chart, index) => {
            return new Promise((resolve) => {
                const chartElement = document.getElementById(chart.containerId.replace('chart-', ''));
                const svgElement = chartElement.querySelector('svg');
                
                const titleElement = chartElement.querySelector('.chart-title');
                let title = 'Chart';
                if (titleElement) {
                    title = titleElement.textContent || titleElement.innerText || 'Chart';
                } else if (chart.chartData?.selectedVariable) {
                    title = `Analysis: ${chart.chartData.selectedVariable}`;
                }
                
                const clonedSvg = svgElement.cloneNode(true);
                
                this.forceSVGVisibility(clonedSvg);
                
                const svgData = new XMLSerializer().serializeToString(clonedSvg);
                const img = new Image();
                
                img.onload = function() {
                    const row = Math.floor(index / chartsPerRow);
                    const col = index % chartsPerRow;
                    
                    const x = padding + col * (chartWidth + chartPadding);
                    const y = padding + row * (chartHeight + 60 * scale + chartPadding);
                    
                    ctx.drawImage(img, x, y, chartWidth, chartHeight);
                    
                    ctx.fillStyle = 'black';
                    ctx.font = `bold ${12 * scale}px Arial`;
                    ctx.textAlign = 'center';
                    
                    const maxTitleWidth = chartWidth * 0.85;
                    const lines = this.wrapText(ctx, title, maxTitleWidth, 12 * scale);
                    
                    const titleStartY = y + chartHeight + 20 * scale;
                    
                    lines.forEach((line, lineIndex) => {
                        ctx.fillText(
                            line, 
                            x + chartWidth / 2, 
                            titleStartY + (lineIndex * 14 * scale)
                        );
                    });
                    
                    resolve();
                }.bind(this);
                
                img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
            });
        });
        
        Promise.all(promises).then(() => {
            const link = document.createElement('a');
            link.download = `charts-export-${new Date().toISOString().slice(0, 10)}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }

    forceSVGVisibility(svgElement) {
        const criticalGroups = [
            '.bars-group',
            '.trend-group', 
            '.axes-group',
            '.grid',
            '.brush-group',
            '.legend-group'
        ];
        
        criticalGroups.forEach(selector => {
            const elements = svgElement.querySelectorAll(selector);
            elements.forEach(element => {
                element.setAttribute('display', 'block');
                element.setAttribute('visibility', 'visible');
                element.setAttribute('opacity', '1');
                element.style.display = 'block';
                element.style.visibility = 'visible';
                element.style.opacity = '1';
            });
        });
        
        const trendLines = svgElement.querySelectorAll('.trend-line');
        trendLines.forEach(element => {
            element.setAttribute('display', 'block');
            element.setAttribute('visibility', 'visible');
            element.setAttribute('opacity', '1');
            element.setAttribute('stroke', '#000000');
            element.setAttribute('stroke-width', '2');
            element.setAttribute('stroke-dasharray', '5,5');
            element.style.display = 'block';
            element.style.visibility = 'visible';
            element.style.opacity = '1';
        });
        
        const trendValues = svgElement.querySelectorAll('.trend-value');
        trendValues.forEach(element => {
            element.setAttribute('display', 'block');
            element.setAttribute('visibility', 'visible');
            element.setAttribute('opacity', '1');
            element.setAttribute('fill', '#000000');
            element.style.display = 'block';
            element.style.visibility = 'visible';
            element.style.opacity = '1';
        });
        
        const visibleElements = svgElement.querySelectorAll('path, line, text, circle, rect');
        visibleElements.forEach(element => {
            const computedStyle = window.getComputedStyle(element);
            if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
                element.style.display = 'block';
                element.style.visibility = 'visible';
                element.style.opacity = '1';
            }
        });
        
        const style = document.createElement('style');
        style.textContent = `
            .trend-group, .trend-line, .trend-value,
            .bars-group, .axes-group, .grid,
            path, line, text, circle, rect {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
            }
            /* Específico para trend line en exportación */
            .trend-line {
                stroke: #000000 !important;
                stroke-width: 2 !important;
                stroke-dasharray: 5,5 !important;
            }
            .trend-value {
                fill: #000000 !important;
            }
        `;
        
        if (svgElement.firstChild) {
            svgElement.insertBefore(style, svgElement.firstChild);
        } else {
            svgElement.appendChild(style);
        }
    }

    wrapText(context, text, maxWidth, fontSize) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine + ' ' + word;
            const metrics = context.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > maxWidth && currentLine !== '') {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);
        return lines;
    }
}