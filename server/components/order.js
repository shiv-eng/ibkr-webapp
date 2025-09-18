import express from "express";
import { ax, pass } from "../utils.js";

const router = express.Router();

router.post("/place", async (req, res) => {
    try {
        const { accountId, ...order } = req.body;
        const { data } = await ax.post(`/iserver/account/${accountId}/orders`, { orders: [order] });
        res.json(data);
    } catch (err) {
        pass(res, err);
    }
});

export default router;