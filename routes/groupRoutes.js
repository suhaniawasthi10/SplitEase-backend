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
import { getGroupStatistics } from "../controllers/groupStatisticsController.js";
import { isAuth } from "../middleware/auth.js";
import { createLimiter } from "../middleware/rateLimiter.js";
import { createGroupValidation, updateGroupValidation, mongoIdValidation } from "../middleware/validation.js";

const router = express.Router();

// All routes require authentication
router.post('/', isAuth, createLimiter, createGroupValidation, createGroup);
router.get('/', isAuth, getGroups);
router.get('/:groupId', isAuth, mongoIdValidation('groupId'), getGroupDetails);
router.put('/:groupId', isAuth, updateGroupValidation, updateGroup);
router.delete('/:groupId', isAuth, mongoIdValidation('groupId'), deleteGroup);
router.post('/:groupId/leave', isAuth, mongoIdValidation('groupId'), leaveGroup);

// Member management
router.post('/:groupId/members', isAuth, mongoIdValidation('groupId'), addMemberFromFriendList);
router.delete('/:groupId/members/:memberId', isAuth, mongoIdValidation('groupId'), removeMember);

// Invitations
router.post('/:groupId/invite', isAuth, mongoIdValidation('groupId'), generateEmailInvite);
router.post('/invite/:token/accept', isAuth, acceptInvite);
router.post('/invite/:token/reject', isAuth, rejectInvite);

// Statistics
router.get('/:groupId/statistics', isAuth, mongoIdValidation('groupId'), getGroupStatistics);

export default router;
