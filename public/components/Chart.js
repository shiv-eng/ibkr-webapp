import { $, formatChange } from '../js/utils.js';
import api from '../js/api.js';

export class Chart {
    constructor() {
        this.chartContainer = $('chartContainer');
        this.chartIntervals = $('chartIntervals');
        this.chartPriceInfo = $('chartPriceInfo');
        this.selectedConid = null;
        this.selectedSymbol = null;
    }

    initialize() {
        this.chartIntervals.addEventListener('click', (e) => {
            if (e.target.matches('.btn-interval')) {
                document.querySelectorAll('.btn-interval').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                const { period, bar } = e.target.dataset;
                const intervalLabel = e.target.textContent;
                this.loadChartWithInterval(period, bar, intervalLabel);
            }
        });
    }
    
    selectStock(conid, symbol) {
        this.selectedConid = conid;
        this.selectedSymbol = symbol;
    }

    async loadChartWithInterval(period, bar, intervalLabel) {
        if (!this.selectedConid) return;
        this.chartContainer.innerHTML = `<div class="loader" style="display:block;"></div>`;
        try {
            const history = await api.GET(`/api/market/history?conid=${this.selectedConid}&period=${period}&bar=${bar}`);
            this.renderChart(history.data, this.selectedSymbol, intervalLabel);
        } catch (e) {
            this.chartContainer.innerHTML = `<p style="color:var(--red)">Failed to load chart data.</p>`;
        }
    }

    updateChartPriceInfo(details) {
        const { symbol, price, marketData, companyName, exchange } = details;
        if (!price || !marketData) {
            this.chartPriceInfo.innerHTML = '';
            return;
        }

        const currentPrice = parseFloat(price.replace(/[^0-9.-]+/g,""));
        const changeValue = parseFloat(marketData.text);
        const openingPrice = currentPrice - changeValue;
        const changePct = openingPrice !== 0 ? (changeValue / openingPrice) * 100 : 0;
        
        this.chartPriceInfo.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                <div>
                    <div style="font-size: 28px; font-weight: 700;">${price}</div>
                    <div class="${marketData.className}" style="font-size: 18px; font-weight: 600;">
                        ${marketData.text} (${changePct.toFixed(2)}%)
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 22px; font-weight: 700;">${symbol}</div>
                    <div style="font-size: 14px; color: var(--text-muted);">${companyName || ''}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">${exchange || ''}</div>
                </div>
            </div>`;
    }

    renderChart(data, symbol, interval) {
        this.chartContainer.innerHTML = '';
        if (window.chart) {
            window.chart.destroy();
            window.chart = null;
        }

        try {
            if (typeof ApexCharts === 'undefined') throw new Error("Charting library failed to load.");
            if (!data || data.length === 0) throw new Error(`No chart data for ${symbol} at ${interval} interval.`);

            const formattedData = data.map(d => ({ x: new Date(d.t), y: d.c }));
            const chartColor = '#4caf50';

            const options = {
                series: [{ name: symbol, data: formattedData }],
                chart: { type: 'area', height: 450, background: 'transparent', zoom: { type: 'x', enabled: true, autoScaleYaxis: true }, toolbar: { autoSelected: 'zoom' } },
                theme: { mode: 'dark' },
                dataLabels: { enabled: false },
                stroke: { curve: 'smooth', width: 2, colors: [chartColor] },
                fill: { type: 'gradient', colors: [chartColor], gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.2, stops: [0, 90, 100] } },
                title: { text: `${symbol} - ${interval} Interval`, align: 'left', style: { color: '#FFF' } },
                xaxis: { type: 'datetime', labels: { style: { colors: '#888' } } },
                yaxis: { labels: { style: { colors: '#888' }, formatter: (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value) } },
                grid: { borderColor: 'rgba(255, 255, 255, 0.1)' },
                tooltip: { theme: 'dark', x: { format: 'dd MMM yyyy, HH:mm' }, y: { formatter: (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value) } },
                markers: { size: 0, hover: { size: 5 } }
            };

            window.chart = new ApexCharts(this.chartContainer, options);
            window.chart.render();
        } catch (e) {
            this.chartContainer.innerHTML = `<p style="color:var(--red)">${e.message}</p>`;
        }
    }
}