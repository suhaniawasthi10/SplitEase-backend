import express from "express";
import {
    createExpense,
    editExpense,
    deleteExpense,
    getExpenses,
    getExpenseDetails,
    changePayer
} from "../controllers/expenseController.js";
import { isAuth } from "../middleware/auth.js";
import { createLimiter } from "../middleware/rateLimiter.js";
import { createExpenseValidation, mongoIdValidation } from "../middleware/validation.js";

const router = express.Router();

// All routes require authentication
router.post('/', isAuth, createLimiter, createExpenseValidation, createExpense);
router.put('/:expenseId', isAuth, mongoIdValidation('expenseId'), editExpense);
router.put('/:expenseId/change-payer', isAuth, mongoIdValidation('expenseId'), changePayer);
router.delete('/:expenseId', isAuth, mongoIdValidation('expenseId'), deleteExpense);
router.get('/', isAuth, getExpenses);
router.get('/:expenseId', isAuth, mongoIdValidation('expenseId'), getExpenseDetails);

export default router;
