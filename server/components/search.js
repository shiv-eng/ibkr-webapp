import express from "express";
import { ax, pass } from "../utils.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { symbol, secType } = req.body;
        const { data } = await ax.post("/iserver/secdef/search", { symbol, secType });
        let resultsArray = [];
        if (Array.isArray(data)) {
            resultsArray = data;
        } else if (typeof data === 'object' && data !== null) {
            const resultKey = Object.keys(data).find(k => Array.isArray(data[k]));
            if (resultKey) {
                resultsArray = data[resultKey];
            }
        }
        const validResults = resultsArray.filter(r => r.conid && r.symbol);
        res.json({ results: validResults });
    } catch (err) {
        pass(res, err);
    }
});

export default router;