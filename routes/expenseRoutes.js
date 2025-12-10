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

const router = express.Router();

// All routes require authentication
router.post('/', isAuth, createExpense);
router.put('/:expenseId', isAuth, editExpense);
router.put('/:expenseId/change-payer', isAuth, changePayer);
router.delete('/:expenseId', isAuth, deleteExpense);
router.get('/', isAuth, getExpenses);
router.get('/:expenseId', isAuth, getExpenseDetails);

export default router;
