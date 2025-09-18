import express from "express";
import { ax, safeGet, pass } from "../utils.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { data: accountsData } = await ax.get("/iserver/accounts");
        if (!accountsData?.accounts?.length) throw new Error("No accounts found.");
        const accountId = accountsData.accounts[0];

        const [summaryRes, ledgerRes] = await Promise.all([
            ax.get(`/portfolio/${accountId}/summary`),
            ax.get(`/portfolio/${accountId}/ledger`)
        ]);

        const summaryData = summaryRes.data || {};
        const ledgerData = ledgerRes.data || {};

        const tradesData = await safeGet(`/iserver/account/trades`);
        const ordersData = await safeGet(`/iserver/account/orders`);
        const positionsData = await safeGet(`/portfolio/${accountId}/positions/0`);

        const findKey = (obj, name) => Object.keys(obj).find(k => k.toLowerCase() === name.toLowerCase());
        const cashHoldings = Object.keys(ledgerData)
            .filter(key => ledgerData[key]?.acctcode === accountId && key !== 'updated')
            .map(key => ({ currency: key, amount: ledgerData[key].cashbalance }));

        const totalUnrealizedPnl = positionsData.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
        const totalRealizedPnl = (tradesData || []).reduce((sum, trade) => sum + (trade.realized_pnl || 0), 0);

        res.json({
            accountId,
            currency: summaryData[findKey(summaryData, 'totalcashvalue')]?.currency || 'USD',
            summary: {
                total: summaryData[findKey(summaryData, 'netliquidation')]?.amount || 0,
                settledCash: summaryData[findKey(summaryData, 'settledcash')]?.amount || 0,
                unrealizedPnl: totalUnrealizedPnl,
                realizedPnl: totalRealizedPnl,
                maintMargin: summaryData[findKey(summaryData, 'maintmarginreq')]?.amount || 0,
                buyingPower: summaryData[findKey(summaryData, 'buyingpower')]?.amount || 0,
            },
            cashHoldings,
            trades: tradesData,
            orders: ordersData.orders || [],
            positions: positionsData
        });
    } catch (err) {
        pass(res, err);
    }
});

export default router;