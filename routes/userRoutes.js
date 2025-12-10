import express from "express";
import { getCurrentUser, updateUser } from "../controllers/userController.js";
import { isAuth } from "../middleware/auth.js";

const router = express.Router();

router.get('/current', isAuth, getCurrentUser);
router.put('/update', isAuth, updateUser);

export default router;
