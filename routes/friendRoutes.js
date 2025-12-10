import express from "express";
import { 
    sendFriendRequest, 
    acceptFriendRequest, 
    rejectFriendRequest, 
    getFriendsList, 
    getPendingRequests, 
    removeFriend,
    searchFriends 
} from "../controllers/friendController.js";
import { isAuth } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.post('/request', isAuth, sendFriendRequest);
router.put('/accept/:requestId', isAuth, acceptFriendRequest);
router.put('/reject/:requestId', isAuth, rejectFriendRequest);
router.get('/list', isAuth, getFriendsList);
router.get('/search', isAuth, searchFriends);
router.get('/pending', isAuth, getPendingRequests);
router.delete('/:friendId', isAuth, removeFriend);

export default router;
