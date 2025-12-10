import express from "express";
import { 
    createSettlement,
    getSettlements,
    getDashboardSummary,
    getDetailedBalances,
    getGroupSettlements
} from "../controllers/settlementController.js";
import { isAuth } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.post('/', isAuth, createSettlement);
router.get('/', isAuth, getSettlements);
router.get('/dashboard/summary', isAuth, getDashboardSummary);
router.get('/dashboard/detailed', isAuth, getDetailedBalances);
router.get('/group/:groupId', isAuth, getGroupSettlements);

export default router;
