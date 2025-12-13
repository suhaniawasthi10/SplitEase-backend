import express from "express";
import { getCurrentUser, updateUser, uploadProfileImage, deleteProfileImage, searchUsers, deleteAccount, updateUpiId } from "../controllers/userController.js";
import { isAuth } from "../middleware/auth.js";
import { updateUserValidation } from "../middleware/validation.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.get('/me', isAuth, getCurrentUser);
router.put('/me', isAuth, updateUserValidation, updateUser);
router.post('/profile-image', isAuth, upload.single('profileImage'), uploadProfileImage);
router.delete('/profile-image', isAuth, deleteProfileImage);
router.get('/search', isAuth, searchUsers);

// UPI ID management
router.put('/upi-id', isAuth, updateUpiId);

// Delete account
router.delete('/account', isAuth, deleteAccount);

export default router;
