import { $, formatCurrency, formatChange } from '../js/utils.js';
import api from '../js/api.js';

export class Dashboard {
    constructor() {
        this.dashboardLoader = $('dashboardLoader');
        this.activeAccountDisplay = $('activeAccountDisplay');
        this.summaryGrid = $('summaryGrid');
        this.tradesTable = $('tradesTable');
        this.positionsTable = $('positionsTable');
        this.ordersTable = $('ordersTable');
        this.dashboardTabs = $('dashboardTabs');
    }

    initialize() {
        document.body.addEventListener('connected', () => this.loadDashboard());

        this.dashboardTabs.addEventListener('click', (e) => {
            const targetButton = e.target.closest('.tab-btn');
            if (targetButton) {
                const tabId = targetButton.dataset.tab;
                this.dashboardTabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                
                targetButton.classList.add('active');
                const activeContent = $(`tab-${tabId}`);
                if (activeContent) {
                    activeContent.classList.add('active');
                }
            }
        });
    }

    async loadDashboard() {
        this.dashboardLoader.classList.add('active');
        try {
            const data = await api.GET('/api/dashboard');
            this.renderDashboard(data);
            document.body.dispatchEvent(new CustomEvent('dashboardLoaded', {
                detail: {
                    currency: data.currency,
                    positions: data.positions
                }
            }));
        } catch (e) {
            console.error("Failed to load dashboard:", e);
            alert("Failed to load dashboard. Please try reconnecting.");
        } finally {
            this.dashboardLoader.classList.remove('active');
        }
    }

    renderDashboard(data) {
        this.activeAccountDisplay.textContent = data.accountId;

        const summaryHtml = `
            <div class="summary-widget"><label>Total Value</label><div class="value">${formatCurrency(data.summary.total, data.currency)}</div></div>
            <div class="summary-widget"><label>Settled Cash</label><div class="value">${formatCurrency(data.summary.settledCash, data.currency)}</div></div>
            <div class="summary-widget"><label>Realized P&L</label><div class="value ${data.summary.realizedPnl >= 0 ? 'price-positive' : 'price-negative'}">${formatCurrency(data.summary.realizedPnl, data.currency)}</div></div>
            <div class="summary-widget"><label>Unrealized P&L</label><div class="value ${data.summary.unrealizedPnl >= 0 ? 'price-positive' : 'price-negative'}">${formatCurrency(data.summary.unrealizedPnl, data.currency)}</div></div>
            <div class="summary-widget"><label>Maint. Margin</label><div class="value">${formatCurrency(data.summary.maintMargin, data.currency)}</div></div>
            <div class="summary-widget"><label>Buying Power</label><div class="value">${formatCurrency(data.summary.buyingPower, data.currency)}</div></div>`;
        this.summaryGrid.innerHTML = summaryHtml;

        const tradesBody = this.tradesTable.querySelector('tbody');
        tradesBody.innerHTML = data.trades?.length ? data.trades.map(t => {
            const quantity = t.size || t.qty || 0;
            const price = parseFloat((t.price || '0').replace(/,/g, ''));
            const action = t.side === 'B' ? 'Buy' : 'Sell';
            const description = (t.order_description || '').replace(/^Bot/i, 'Bought').replace(/^Sld/i, 'Sold');
            return `<tr>
                        <td class="${action === 'Buy' ? 'price-positive' : 'price-negative'}">${action}</td>
                        <td>${quantity}</td>
                        <td><b>${t.symbol}</b></td>
                        <td>${description}</td>
                        <td>${formatCurrency(price, t.currency)}</td>
                        <td>${formatCurrency(t.net_amount, t.currency)}</td>
                    </tr>`;
        }).join('') : `<tr><td colspan="6" style="text-align:center;">No executed trades.</td></tr>`;

        const posBody = this.positionsTable.querySelector('tbody');
        posBody.innerHTML = data.positions?.length ? data.positions.map(p => 
            // --- FIX: Corrected data-company-name to use p.name ---
            `<tr style="cursor: pointer;" 
                 data-conid="${p.conid}" 
                 data-symbol="${p.contractDesc}" 
                 data-company-name="${p.name}" 
                 data-exchange="${p.listingExchange}">
                <td><b>${p.contractDesc}</b></td>
                <td>${p.position}</td>
                <td>${formatCurrency(p.mktPrice, p.currency)}</td>
                <td>${formatCurrency(p.mktValue, p.currency)}</td>
                <td>${formatCurrency(p.avgCost, p.currency)}</td>
                <td class="${formatChange(p.unrealizedPnl).className}">${formatCurrency(p.unrealizedPnl, p.currency)}</td>
             </tr>`
        ).join('') : `<tr><td colspan="6" style="text-align:center;">No positions.</td></tr>`;
        
        posBody.querySelectorAll('tr').forEach(row => {
            row.addEventListener('click', async () => {
                const { conid, symbol, companyName, exchange } = row.dataset;
                if (!conid || conid === 'undefined') return;
                
                posBody.querySelectorAll('tr').forEach(r => r.classList.remove('selected-row'));
                row.classList.add('selected-row');
                document.querySelectorAll('#searchResults tbody tr').forEach(r => r.classList.remove('selected-row'));

                const { data: marketData } = await api.GET(`/api/market/snapshot?conids=${conid}`);
                const price = formatCurrency(marketData[0]['31']);
                const change = formatChange(marketData[0]['83']);

                document.body.dispatchEvent(new CustomEvent('stockSelected', {
                    detail: {
                        conid: conid,
                        symbol: symbol,
                        price: price,
                        marketData: change,
                        companyName: companyName,
                        exchange: exchange
                    }
                }));
            });
        });

        const ordBody = this.ordersTable.querySelector('tbody');
        ordBody.innerHTML = data.orders?.length ? data.orders.map(o => 
            `<tr>
                <td class="${o.side === 'BUY' ? 'price-positive' : 'price-negative'}">${o.side}</td>
                <td><b>${o.ticker}</b></td>
                <td>${o.orderDesc}</td>
                <td>${o.status}</td>
            </tr>`
        ).join('') : `<tr><td colspan="4" style="text-align:center;">No open orders.</td></tr>`;
    }
}