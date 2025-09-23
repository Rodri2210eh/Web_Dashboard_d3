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
            const title = chart.chartData?.selectedVariable || 'Unnamed Chart';
            
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
        const padding = 20 * scale;
        const chartPadding = 10 * scale;
        
        let chartsPerRow;
        if (chartsToExport.length === 1) chartsPerRow = 1;
        else if (chartsToExport.length <= 4) chartsPerRow = 2;
        else chartsPerRow = 3;
        
        const firstSvg = document.querySelector(`#${chartsToExport[0].containerId} svg`);
        const chartWidth = firstSvg.clientWidth * scale;
        const chartHeight = firstSvg.clientHeight * scale;
        
        const cols = Math.min(chartsPerRow, chartsToExport.length);
        const rows = Math.ceil(chartsToExport.length / chartsPerRow);
        
        canvas.width = cols * chartWidth + (cols - 1) * chartPadding + 2 * padding;
        canvas.height = rows * chartHeight + (rows - 1) * chartPadding + 2 * padding;
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'black';
        ctx.font = `bold ${16 * scale}px Arial`;
        ctx.fillText('Charts Export', padding, padding - 1 * scale);
        
        const promises = chartsToExport.map((chart, index) => {
            return new Promise((resolve) => {
                const svgElement = document.querySelector(`#${chart.containerId} svg`);
                const title = chart.chartData?.selectedVariable || 'Chart';
                
                const svgData = new XMLSerializer().serializeToString(svgElement);
                const img = new Image();
                
                img.onload = function() {
                    const row = Math.floor(index / chartsPerRow);
                    const col = index % chartsPerRow;
                    
                    const x = padding + col * (chartWidth + chartPadding);
                    const y = padding + row * (chartHeight + chartPadding);
                    
                    ctx.drawImage(img, x, y, chartWidth, chartHeight);
                    
                    ctx.fillStyle = 'black';
                    ctx.font = `bold ${12 * scale}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.fillText(title, x + chartWidth/2, y + chartHeight + 15 * scale);
                    
                    resolve();
                };
                
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
}