import express from "express";
import { getActivities } from "../controllers/activityController.js";
import { isAuth } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.get('/', isAuth, getActivities);

export default router;
