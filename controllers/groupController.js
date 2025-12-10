import Group from "../models/group.js";
import GroupInvite from "../models/groupInvite.js";
import Friend from "../models/friend.js";
import User from "../models/user.js";
import Activity from "../models/activity.js";
import Expense from "../models/expense.js";
import Settlement from "../models/settlement.js";
import Balance from "../models/balance.js";
import { sendGroupInviteEmail } from "../services/emailService.js";
import mongoose from "mongoose";

// Helper function to check if user has required role
const hasPermission = (group, userId, requiredRoles) => {
    const member = group.members.find(m => m.userId.toString() === userId.toString());
    if (!member) return false;
    return requiredRoles.includes(member.role);
};

// Helper function to check if user can invite members
const canInviteMembers = (group, userId) => {
    const member = group.members.find(m => m.userId.toString() === userId.toString());
    if (!member) return false;
    // Owner and admin can always invite
    if (['owner', 'admin'].includes(member.role)) return true;
    // Regular members can invite only if memberInvitesAllowed is true
    return group.memberInvitesAllowed;
};

// Create a new group
export const createGroup = async (req, res) => {
    const { name, description, category, memberInvitesAllowed } = req.body;
    const userId = req.userId;

    try {
        if (!name || name.trim() === '') {
            return res.status(400).json({ message: "Group name is required" });
        }

        // Create group with creator as owner
        const group = await Group.create({
            name: name.trim(),
            description: description || '',
            category: category || 'other',
            members: [{
                userId,
                role: 'owner'
            }],
            memberInvitesAllowed: memberInvitesAllowed || false,
            createdBy: userId
        });

        // Log activity
        await Activity.create({
            activityType: 'group_created',
            userId,
            groupId: group._id,
            description: `Created group: ${group.name}`
        });

        const populatedGroup = await Group.findById(group._id).populate('members.userId', 'username name email');

        return res.status(201).json({
            message: "Group created successfully",
            group: populatedGroup
        });
    } catch (error) {
        console.error("Error creating group:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// Get all groups for the current user
export const getGroups = async (req, res) => {
    const userId = req.userId;

    try {
        const groups = await Group.find({
            'members.userId': userId
        }).populate('members.userId', 'username name email');

        return res.status(200).json({
            count: groups.length,
            groups
        });
    } catch (error) {
        console.error("Error fetching groups:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// Get group details
export const getGroupDetails = async (req, res) => {
    const { groupId } = req.params;
    const userId = req.userId;

    try {
        const group = await Group.findById(groupId).populate('members.userId', 'username name email');

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user is a member
        const isMember = group.members.some(m => m.userId._id.toString() === userId);
        if (!isMember) {
            return res.status(403).json({ message: "You are not a member of this group" });
        }

        // Calculate total expenses for this group
        const expenseStats = await Expense.aggregate([
            { $match: { groupId: new mongoose.Types.ObjectId(groupId) } },
            { $group: {
                _id: null,
                totalExpenses: { $sum: '$amount' },
                expenseCount: { $sum: 1 }
            }}
        ]);

        // Calculate total settlements for this group
        const settlementStats = await Settlement.aggregate([
            { $match: { groupId: new mongoose.Types.ObjectId(groupId) } },
            { $group: {
                _id: null,
                totalSettlements: { $sum: '$amount' },
                settlementCount: { $sum: 1 }
            }}
        ]);

        // Get user's balance summary for this group
        const userGroupBalances = await Balance.find({
            groupId,
            $or: [
                { fromUserId: userId },
                { toUserId: userId }
            ]
        }).populate('fromUserId toUserId', 'username name');

        // Calculate user's balance in this group
        let userOwes = 0;
        let userOwed = 0;
        const balanceDetails = [];

        userGroupBalances.forEach(balance => {
            if (balance.fromUserId._id.toString() === userId && balance.amount > 0) {
                userOwes += balance.amount;
                balanceDetails.push({
                    type: 'owes',
                    user: balance.toUserId,
                    amount: balance.amount
                });
            } else if (balance.toUserId._id.toString() === userId && balance.amount > 0) {
                userOwed += balance.amount;
                balanceDetails.push({
                    type: 'owed',
                    user: balance.fromUserId,
                    amount: balance.amount
                });
            }
        });

        return res.status(200).json({ 
            group,
            stats: {
                totalExpenses: expenseStats[0]?.totalExpenses || 0,
                expenseCount: expenseStats[0]?.expenseCount || 0,
                totalSettlements: settlementStats[0]?.totalSettlements || 0,
                settlementCount: settlementStats[0]?.settlementCount || 0
            },
            userBalance: {
                youOwe: parseFloat(userOwes.toFixed(2)),
                youreOwed: parseFloat(userOwed.toFixed(2)),
                netBalance: parseFloat((userOwed - userOwes).toFixed(2)),
                balanceDetails
            }
        });
    } catch (error) {
        console.error("Error fetching group details:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// Update group (owner/admin only)
export const updateGroup = async (req, res) => {
    const { groupId } = req.params;
    const { name, description, memberInvitesAllowed } = req.body;
    const userId = req.userId;

    try {
        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check permissions (only owner and admin can update)
        if (!hasPermission(group, userId, ['owner', 'admin'])) {
            return res.status(403).json({ message: "Only owner and admin can update group settings" });
        }

        // Update fields
        if (name) group.name = name.trim();
        if (description !== undefined) group.description = description;
        if (memberInvitesAllowed !== undefined) group.memberInvitesAllowed = memberInvitesAllowed;

        await group.save();

        // Log activity
        await Activity.create({
            activityType: 'group_updated',
            userId,
            groupId: group._id,
            description: `Updated group: ${group.name}`
        });

        const updatedGroup = await Group.findById(groupId).populate('members.userId', 'username name email');

        return res.status(200).json({
            message: "Group updated successfully",
            group: updatedGroup
        });
    } catch (error) {
        console.error("Error updating group:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// Delete group (owner only)
export const deleteGroup = async (req, res) => {
    const { groupId } = req.params;
    const userId = req.userId;

    try {
        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user is owner
        if (!hasPermission(group, userId, ['owner'])) {
            return res.status(403).json({ message: "Only group owner can delete the group" });
        }

        // Delete the group
        await Group.findByIdAndDelete(groupId);

        // Log activity
        await Activity.create({
            activityType: 'group_deleted',
            userId,
            groupId,
            description: `Deleted group: ${group.name}`
        });

        return res.status(200).json({
            message: "Group deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting group:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// Leave group
export const leaveGroup = async (req, res) => {
    const { groupId } = req.params;
    const userId = req.userId;

    try {
        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user is a member
        const memberIndex = group.members.findIndex(m => m.userId.toString() === userId);
        if (memberIndex === -1) {
            return res.status(400).json({ message: "You are not a member of this group" });
        }

        // Check if user is owner
        const member = group.members[memberIndex];
        if (member.role === 'owner') {
            return res.status(400).json({ 
                message: "Owner cannot leave the group. Transfer ownership or delete the group instead." 
            });
        }

        // Remove member
        group.members.splice(memberIndex, 1);
        await group.save();

        // Log activity
        await Activity.create({
            activityType: 'group_member_removed',
            userId,
            groupId,
            description: `Left group: ${group.name}`
        });

        return res.status(200).json({
            message: "Left group successfully"
        });
    } catch (error) {
        console.error("Error leaving group:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// Add member from friend list (requires permission)
export const addMemberFromFriendList = async (req, res) => {
    const { groupId } = req.params;
    const { friendId, role } = req.body;
    const userId = req.userId;

    try {
        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user can invite members
        if (!canInviteMembers(group, userId)) {
            return res.status(403).json({ 
                message: "You don't have permission to add members to this group" 
            });
        }

        // Verify friendship
        const friendship = await Friend.findOne({
            $or: [
                { userId, friendId, status: 'accepted' },
                { userId: friendId, friendId: userId, status: 'accepted' }
            ]
        });

        if (!friendship) {
            return res.status(400).json({ message: "You can only add friends to the group" });
        }

        // Check if already a member
        const isAlreadyMember = group.members.some(m => m.userId.toString() === friendId);
        if (isAlreadyMember) {
            return res.status(400).json({ message: "User is already a member of this group" });
        }

        // Add member
        group.members.push({
            userId: friendId,
            role: role || 'member'
        });

        await group.save();

        const friend = await User.findById(friendId);

        // Log activity
        await Activity.create({
            activityType: 'group_member_added',
            userId,
            targetUserId: friendId,
            groupId,
            description: `Added ${friend.username} to group: ${group.name}`
        });

        const updatedGroup = await Group.findById(groupId).populate('members.userId', 'username name email');

        return res.status(200).json({
            message: "Member added successfully",
            group: updatedGroup
        });
    } catch (error) {
        console.error("Error adding member:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// Generate email invite (requires permission)
export const generateEmailInvite = async (req, res) => {
    const { groupId } = req.params;
    const { email } = req.body;
    const userId = req.userId;

    try {
        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user can invite members
        if (!canInviteMembers(group, userId)) {
            return res.status(403).json({ 
                message: "You don't have permission to invite members to this group" 
            });
        }

        if (!email || !email.includes('@')) {
            return res.status(400).json({ message: "Valid email is required" });
        }

        // Check if user with this email exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            // Check if already a member
            const isAlreadyMember = group.members.some(m => m.userId.toString() === existingUser._id.toString());
            if (isAlreadyMember) {
                return res.status(400).json({ message: "User is already a member of this group" });
            }
        }

        // Check for existing pending invite
        const existingInvite = await GroupInvite.findOne({
            groupId,
            invitedEmail: email.toLowerCase(),
            status: 'pending'
        });

        if (existingInvite) {
            return res.status(400).json({ message: "Invite already sent to this email" });
        }

        // Create invite
        const invite = await GroupInvite.create({
            groupId,
            invitedBy: userId,
            invitedEmail: email.toLowerCase(),
            status: 'pending'
        });

        // Generate token
        invite.generateToken();
        await invite.save();

        // Get inviter details
        const inviter = await User.findById(userId);
        const inviteLink = `${process.env.FRONTEND_URL}/invite/${invite.token}`;

        // Send email via Gmail API (non-blocking)
        sendGroupInviteEmail(email.toLowerCase(), group.name, inviter.name, inviteLink)
            .then(success => {
                if (success) {
                    console.log(`Invite email sent to ${email}`);
                } else {
                    console.log(`Failed to send invite email to ${email}, but invite created`);
                }
            })
            .catch(err => {
                console.error('Email sending error:', err);
            });

        return res.status(201).json({
            message: "Invite created successfully and email sent",
            invite: {
                _id: invite._id,
                token: invite.token,
                inviteLink,
                expiresAt: invite.expiresAt
            }
        });
    } catch (error) {
        console.error("Error generating invite:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// Accept invite
export const acceptInvite = async (req, res) => {
    const { token } = req.params;
    const userId = req.userId;

    try {
        const invite = await GroupInvite.findOne({ token, status: 'pending' })
            .populate('groupId');

        if (!invite) {
            return res.status(404).json({ message: "Invalid or expired invite" });
        }

        // Check if invite is expired
        if (invite.isExpired()) {
            invite.status = 'expired';
            await invite.save();
            return res.status(400).json({ message: "Invite has expired" });
        }

        const group = invite.groupId;

        // Check if already a member
        const isAlreadyMember = group.members.some(m => m.userId.toString() === userId);
        if (isAlreadyMember) {
            return res.status(400).json({ message: "You are already a member of this group" });
        }

        // Add user to group
        group.members.push({
            userId,
            role: 'member'
        });

        await group.save();

        // Update invite status
        invite.status = 'accepted';
        invite.invitedUserId = userId;
        await invite.save();

        // Log activity
        await Activity.create({
            activityType: 'group_member_added',
            userId,
            groupId: group._id,
            description: `Joined group: ${group.name} via invite`
        });

        const updatedGroup = await Group.findById(group._id).populate('members.userId', 'username name email');

        return res.status(200).json({
            message: "Successfully joined the group",
            group: updatedGroup
        });
    } catch (error) {
        console.error("Error accepting invite:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// Reject invite
export const rejectInvite = async (req, res) => {
    const { token } = req.params;
    const userId = req.userId;

    try {
        const invite = await GroupInvite.findOne({ token, status: 'pending' });

        if (!invite) {
            return res.status(404).json({ message: "Invalid or expired invite" });
        }

        // Update invite status
        invite.status = 'rejected';
        invite.invitedUserId = userId;
        await invite.save();

        return res.status(200).json({
            message: "Invite rejected"
        });
    } catch (error) {
        console.error("Error rejecting invite:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// Remove member (owner/admin only)
export const removeMember = async (req, res) => {
    const { groupId, memberId } = req.params;
    const userId = req.userId;

    try {
        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check permissions
        if (!hasPermission(group, userId, ['owner', 'admin'])) {
            return res.status(403).json({ 
                message: "Only owner and admin can remove members" 
            });
        }

        // Find member to remove
        const memberIndex = group.members.findIndex(m => m.userId.toString() === memberId);
        if (memberIndex === -1) {
            return res.status(404).json({ message: "Member not found in group" });
        }

        const memberToRemove = group.members[memberIndex];

        // Cannot remove owner
        if (memberToRemove.role === 'owner') {
            return res.status(400).json({ message: "Cannot remove group owner" });
        }

        // Remove member
        group.members.splice(memberIndex, 1);
        await group.save();

        const removedUser = await User.findById(memberId);

        // Log activity
        await Activity.create({
            activityType: 'group_member_removed',
            userId,
            targetUserId: memberId,
            groupId,
            description: `Removed ${removedUser.username} from group: ${group.name}`
        });

        return res.status(200).json({
            message: "Member removed successfully"
        });
    } catch (error) {
        console.error("Error removing member:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
