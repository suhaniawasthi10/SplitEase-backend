import express from "express";
import { 
    createGroup,
    getGroups,
    getGroupDetails,
    updateGroup,
    deleteGroup,
    leaveGroup,
    addMemberFromFriendList,
    generateEmailInvite,
    acceptInvite,
    rejectInvite,
    removeMember
} from "../controllers/groupController.js";
import { isAuth } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.post('/', isAuth, createGroup);
router.get('/', isAuth, getGroups);
router.get('/:groupId', isAuth, getGroupDetails);
router.put('/:groupId', isAuth, updateGroup);
router.delete('/:groupId', isAuth, deleteGroup);
router.post('/:groupId/leave', isAuth, leaveGroup);

// Member management
router.post('/:groupId/members', isAuth, addMemberFromFriendList);
router.delete('/:groupId/members/:memberId', isAuth, removeMember);

// Invitations
router.post('/:groupId/invite', isAuth, generateEmailInvite);
router.post('/invite/:token/accept', isAuth, acceptInvite);
router.post('/invite/:token/reject', isAuth, rejectInvite);

export default router;
