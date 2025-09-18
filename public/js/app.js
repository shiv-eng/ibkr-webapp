import { ConnectionManager } from '../components/ConnectionManager.js';
import { Dashboard } from '../components/Dashboard.js';
import { StockSearch } from '../components/StockSearch.js';
import { Chart } from '../components/Chart.js';
import { OrderPlacement } from '../components/OrderPlacement.js';
import { $ } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const app = {
        // Shared State
        state: {
            baseCurrency: 'USD',
            currentPositions: {}
        },

        // Initialize Components
        connectionManager: new ConnectionManager(),
        dashboard: new Dashboard(),
        stockSearch: new StockSearch(),
        chart: new Chart(),
        orderPlacement: new OrderPlacement(),

        initialize() {
            // Attach the API log function to the window object so api.js can call it
            window.updateApiLog = this.updateApiLog;

            this.connectionManager.initialize();
            this.dashboard.initialize();
            this.stockSearch.initialize();
            this.chart.initialize();
            this.orderPlacement.initialize(this.state); // Pass state to order placement

            this.bindEvents();
        },
        
        updateApiLog(log) {
            const logEl = $('apiLog');
            if (!logEl) return;
            const entry = document.createElement('div');
            entry.style.color = log.ok ? 'var(--green)' : 'var(--red)';
            entry.style.borderBottom = '1px dashed var(--border-color)';
            entry.style.marginBottom = '1em';
            entry.style.paddingBottom = '1em';
            entry.innerHTML = `<details><summary><strong>[${log.timestamp}] ${log.method} ${log.status}</strong> ${log.url}</summary><pre><code>${JSON.stringify({ Request: log.req, Response: log.res }, null, 2)}</code></pre></details>`;
            logEl.prepend(entry);
        },

        bindEvents() {
            // Event listener for dashboard data loading
            document.body.addEventListener('dashboardLoaded', (e) => {
                const { currency, positions } = e.detail;
                this.state.baseCurrency = currency;
                this.state.currentPositions = {};
                 (positions || []).forEach(p => {
                    this.state.currentPositions[p.conid] = { position: p.position, contractDesc: p.contractDesc };
                });
            });

            // Event for stock selection
            document.body.addEventListener('stockSelected', (e) => {
                const { conid, symbol } = e.detail;
                
                // Pass the entire detail object to the chart
                this.chart.selectStock(conid, symbol);
                this.chart.updateChartPriceInfo(e.detail);
                
                const defaultIntervalBtn = document.querySelector('#chartIntervals .btn-interval.active');
                if (defaultIntervalBtn) {
                    defaultIntervalBtn.click();
                }

                // Update Order Form
                this.orderPlacement.updateOrderForm(conid, symbol);
            });

            // Event for reloading dashboard after order placement
             document.body.addEventListener('orderPlaced', () => {
                setTimeout(() => this.dashboard.loadDashboard(), 2000);
            });
        }
    };

    app.initialize();
});