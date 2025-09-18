const ui = {
    $: (id) => document.getElementById(id),
    
    formatCurrency: (val, cur = 'USD') => !isNaN(parseFloat(val)) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(val) : '-',
    formatChange: (val, isPct) => {
        const num = parseFloat(val);
        if (isNaN(num)) return { text: '-', className: '' };
        const className = num > 0 ? 'price-positive' : 'price-negative';
        return { text: (num > 0 ? '+' : '') + num.toFixed(2) + (isPct ? '%' : ''), className };
    },

    setConnectionStatus(status, message = '') {
        const statusEl = this.$('connectionStatus');
        const connectBtn = this.$('btnConnect');
        const disconnectBtn = this.$('btnDisconnect');
        statusEl.textContent = message || status;
        statusEl.className = `status-badge ${status.toLowerCase()}`;
        const isConnected = status === 'Connected';
        connectBtn.classList.toggle('hidden', isConnected);
        disconnectBtn.classList.toggle('hidden', !isConnected);
        ['btnSearch', 'btnPlaceOrder'].forEach(id => this.$(id).disabled = !isConnected);
        this.$('portfolioDashboard').classList.toggle('hidden', !isConnected);
        if (!isConnected) {
            if (window.chart) { window.chart.destroy(); window.chart = null; }
            this.$('chartContainer').innerHTML = `<p style="color:var(--text-muted)">Connect to view charts.</p>`;
            this.$('chartPriceInfo').innerHTML = '';
        }
    },

    updateChartPriceInfo(price, changeData) {
        const container = this.$('chartPriceInfo');
        if (!price || !changeData) {
            container.innerHTML = '';
            return;
        }
        const currentPrice = parseFloat(price.replace(/[^0-9.-]+/g,""));
        const changeValue = parseFloat(changeData.text);
        const openingPrice = currentPrice - changeValue;
        const changePct = openingPrice !== 0 ? (changeValue / openingPrice) * 100 : 0;
        
        container.innerHTML = `
            <div style="display: flex; align-items: flex-end; gap: 16px;">
                <div style="font-size: 28px; font-weight: 700;">${price}</div>
                <div class="${changeData.className}" style="font-size: 18px; font-weight: 600; padding-bottom: 2px;">
                    ${changeData.text} (${changePct.toFixed(2)}%)
                </div>
            </div>`;
    },

    renderChart(data, symbol, interval) {
        const chartContainer = this.$('chartContainer');
        chartContainer.innerHTML = '';
        if (window.chart) { window.chart.destroy(); window.chart = null; }

        try {
            if (typeof ApexCharts === 'undefined') throw new Error("Charting library failed to load.");
            if (!data || data.length === 0) throw new Error(`No chart data for ${symbol} at ${interval} interval.`);
            
            const formattedData = data.map(d => ({ x: new Date(d.t), y: d.c }));
            
            const chartColor = '#4caf50'; // Always use green

            const options = {
                series: [{ name: symbol, data: formattedData }],
                chart: {
                    type: 'area',
                    height: 450,
                    background: 'transparent',
                    zoom: {
                        type: 'x',
                        enabled: true,
                        autoScaleYaxis: true
                    },
                    toolbar: {
                        autoSelected: 'zoom'
                    }
                },
                theme: {
                    mode: 'dark'
                },
                dataLabels: {
                    enabled: false
                },
                stroke: {
                    curve: 'smooth',
                    width: 2,
                    colors: [chartColor]
                },
                fill: {
                    type: 'gradient',
                    colors: [chartColor],
                    gradient: {
                        shadeIntensity: 1,
                        opacityFrom: 0.7,
                        opacityTo: 0.2,
                        stops: [0, 90, 100]
                    }
                },
                title: {
                    text: `${symbol} - ${interval} Interval`,
                    align: 'left',
                    style: {
                        color: '#FFF'
                    }
                },
                xaxis: {
                    type: 'datetime',
                    labels: {
                        style: {
                            colors: '#888'
                        }
                    }
                },
                yaxis: {
                    labels: {
                        style: {
                            colors: '#888'
                        },
                        formatter: (value) => {
                            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
                        }
                    }
                },
                grid: {
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                },
                tooltip: {
                    theme: 'dark',
                    x: {
                        format: 'dd MMM yyyy, HH:mm'
                    },
                    y: {
                        formatter: (value) => {
                            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
                        }
                    }
                },
                markers: {
                    size: 0,
                    hover: {
                        size: 5
                    }
                }
            };

            window.chart = new ApexCharts(chartContainer, options);
            window.chart.render();

        } catch (e) {
            chartContainer.innerHTML = `<p style="color:var(--red)">${e.message}</p>`;
        }
    },

    renderDashboard(data) {
        this.$('activeAccountDisplay').textContent = data.accountId;
        
        const summaryHtml = `
            <div class="summary-widget"><label>Total Value</label><div class="value">${this.formatCurrency(data.summary.total, data.currency)}</div></div>
            <div class="summary-widget"><label>Settled Cash</label><div class="value">${this.formatCurrency(data.summary.settledCash, data.currency)}</div></div>
            <div class="summary-widget"><label>Realized P&L</label><div class="value ${data.summary.realizedPnl >= 0 ? 'price-positive' : 'price-negative'}">${this.formatCurrency(data.summary.realizedPnl, data.currency)}</div></div>
            <div class="summary-widget"><label>Unrealized P&L</label><div class="value ${data.summary.unrealizedPnl >= 0 ? 'price-positive' : 'price-negative'}">${this.formatCurrency(data.summary.unrealizedPnl, data.currency)}</div></div>
            <div class="summary-widget"><label>Maint. Margin</label><div class="value">${this.formatCurrency(data.summary.maintMargin, data.currency)}</div></div>
            <div class="summary-widget"><label>Buying Power</label><div class="value">${this.formatCurrency(data.summary.buyingPower, data.currency)}</div></div>`;
        this.$('summaryGrid').innerHTML = summaryHtml;
        
        const tradesBody = this.$('tradesTable').querySelector('tbody');
        tradesBody.innerHTML = data.trades?.length ? data.trades.map(t => {
            const quantity = t.size || t.qty || 0;
            const price = parseFloat((t.price || '0').replace(/,/g, ''));
            const action = t.side === 'B' ? 'Buy' : 'Sell';
            const description = (t.order_description || '').replace(/^Bot/i, 'Bought').replace(/^Sld/i, 'Sold');
            return `<tr><td class="${action === 'Buy' ? 'price-positive' : 'price-negative'}">${action}</td><td>${quantity}</td><td><b>${t.symbol}</b></td><td>${description}</td><td>${this.formatCurrency(price, t.currency)}</td><td>${this.formatCurrency(quantity * price, t.currency)}</td></tr>`;
        }).join('') : `<tr><td colspan="6" style="text-align:center;">No executed trades.</td></tr>`;
        
        const posBody = this.$('positionsTable').querySelector('tbody');
        posBody.innerHTML = data.positions?.length ? data.positions.map(p => `<tr><td><b>${p.contractDesc}</b></td><td>${p.position}</td><td>${this.formatCurrency(p.mktPrice, p.currency)}</td><td>${this.formatCurrency(p.mktValue, p.currency)}</td><td>${this.formatCurrency(p.avgCost, p.currency)}</td><td class="${this.formatChange(p.unrealizedPnL).className}">${this.formatCurrency(p.unrealizedPnL, p.currency)}</td></tr>`).join('') : `<tr><td colspan="6" style="text-align:center;">No positions.</td></tr>`;
        
        const ordBody = this.$('ordersTable').querySelector('tbody');
        ordBody.innerHTML = data.orders?.length ? data.orders.map(o => `<tr><td class="${o.side === 'BUY' ? 'price-positive' : 'price-negative'}">${o.side}</td><td><b>${o.ticker}</b></td><td>${o.orderDesc}</td><td>${o.status}</td></tr>`).join('') : `<tr><td colspan="4" style="text-align:center;">No open orders.</td></tr>`;
    },

    renderSearchResults(results, searchTerm) {
        const resBody = this.$('searchResults').querySelector('tbody');
        if (!results?.length) {
            resBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No results for "${searchTerm}".</td></tr>`;
            return;
        }
        resBody.innerHTML = results.map(r => {
            const data = r.marketData || {};
            const price = this.formatCurrency(data['31']);
            // Pass the raw market data into the row's dataset for later use
            return `<tr data-market-data='${JSON.stringify({data})}'>
                        <td><b>${r.symbol}</b></td>
                        <td>${r.companyName}</td>
                        <td>${r.description || 'N/A'}</td>
                        <td>${price}</td>
                        <td><button class="btn btn-outline" onclick="app.selectStock(event, ${r.conid}, '${r.symbol}')">Select</button></td>
                    </tr>`;
        }).join('');
    },
    
    updateApiLog(log) {
        const logEl = this.$('apiLog');
        if (!logEl) return;
        const entry = document.createElement('div');
        entry.style.color = log.ok ? 'var(--green)' : 'var(--red)';
        entry.style.borderBottom = '1px dashed var(--border-color)';
        entry.style.marginBottom = '1em';
        entry.style.paddingBottom = '1em';
        entry.innerHTML = `<details><summary><strong>[${log.timestamp}] ${log.method} ${log.status}</strong> ${log.url}</summary><pre><code>${JSON.stringify({ Request: log.req, Response: log.res }, null, 2)}</code></pre></details>`;
        logEl.prepend(entry);
    }
};