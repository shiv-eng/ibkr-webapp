export const $ = (id) => document.getElementById(id);

export const formatCurrency = (val, cur = 'USD') => !isNaN(parseFloat(val)) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(val) : '-';

export const formatChange = (val, isPct) => {
    const num = parseFloat(val);
    if (isNaN(num)) return { text: '-', className: '' };
    const className = num > 0 ? 'price-positive' : 'price-negative';
    return { text: (num > 0 ? '+' : '') + num.toFixed(2) + (isPct ? '%' : ''), className };
};