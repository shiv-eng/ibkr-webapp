import { $, formatCurrency, formatChange } from '../js/utils.js';
import api from '../js/api.js';

export class StockSearch {
    constructor() {
        this.searchInput = $('searchInput');
        this.btnSearch = $('btnSearch');
        this.searchResults = $('searchResults').querySelector('tbody');
    }

    initialize() {
        this.btnSearch.addEventListener('click', () => this.search());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.search();
            }
        });
    }

    async search() {
        const symbol = this.searchInput.value.trim();
        if (!symbol) return;
        this.btnSearch.classList.add('loading');
        this.searchResults.innerHTML = `<tr><td colspan="5" style="text-align:center;">Searching...</td></tr>`;
        try {
            const { results } = await api.POST(`/api/search`, { symbol, secType: 'STK' });
            if (!results?.length) {
                this.searchResults.innerHTML = `<tr><td colspan="5" style="text-align:center;">No results for "${symbol}".</td></tr>`;
                return;
            }
            const conids = results.map(r => r.conid).join(',');
            const { data: marketData } = await api.GET(`/api/market/snapshot?conids=${conids}`);
            const dataMap = marketData.reduce((map, item) => ({ ...map, [item.conid]: item }), {});
            results.forEach(r => r.marketData = dataMap[r.conid]);
            this.renderSearchResults(results, symbol);
        } catch (e) {
            this.searchResults.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--red);">Error: ${e.message}</td></tr>`;
        } finally {
            this.btnSearch.classList.remove('loading');
        }
    }

    renderSearchResults(results, searchTerm) {
        if (!results?.length) {
            this.searchResults.innerHTML = `<tr><td colspan="5" style="text-align:center;">No results for "${searchTerm}".</td></tr>`;
            return;
        }
        this.searchResults.innerHTML = results.map(r => {
            const data = r.marketData || {};
            const price = formatCurrency(data['31']);
            return `<tr data-market-data='${JSON.stringify({data})}'>
                        <td><b>${r.symbol}</b></td>
                        <td>${r.companyName}</td>
                        <td>${r.description || 'N/A'}</td>
                        <td>${price}</td>
                        <td><button class="btn btn-outline">Select</button></td>
                    </tr>`;
        }).join('');

        this.searchResults.querySelectorAll('tr').forEach((row, i) => {
            row.addEventListener('click', (event) => {
                this.searchResults.querySelectorAll('tr').forEach(r => r.classList.remove('selected-row'));
                row.classList.add('selected-row');

                const r = results[i];
                const data = r.marketData || {};
                const price = formatCurrency(data['31']);
                const change = formatChange(data['83']);
                
                document.body.dispatchEvent(new CustomEvent('stockSelected', {
                    detail: {
                        conid: r.conid,
                        symbol: r.symbol,
                        price: price,
                        marketData: change,
                        companyName: r.companyName,
                        exchange: r.description || 'N/A'
                    }
                }));
            });
        });
    }
}