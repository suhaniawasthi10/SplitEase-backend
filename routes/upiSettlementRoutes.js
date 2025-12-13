import express from "express";
import { createUpiSettlement, confirmUpiPayment, cancelUpiPayment } from "../controllers/upiSettlementController.js";
import { isAuth } from "../middleware/auth.js";

const router = express.Router();

// UPI settlement routes
router.post('/upi', isAuth, createUpiSettlement);
router.put('/:id/confirm', isAuth, confirmUpiPayment);
router.put('/:id/cancel', isAuth, cancelUpiPayment);

export default router;
