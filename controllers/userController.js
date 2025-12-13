import User from "../models/user.js";
import Friend from "../models/friend.js";
import Group from "../models/group.js";
import Expense from "../models/expense.js";
import Settlement from "../models/settlement.js";
import Balance from "../models/balance.js";
import Activity from "../models/activity.js";
import cloudinary from '../config/cloudinary.js';
import bcrypt from 'bcryptjs';

export const getCurrentUser = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const user = await User.findById(req.userId).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Format user response to match frontend expectations
        const userResponse = {
            id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            preferredCurrency: user.preferredCurrency,
            upiId: user.upiId,
            profileImage: user.profileImage || { url: null, publicId: null },
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        return res.status(200).json({ user: userResponse });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};

// Update user profile
export const updateUser = async (req, res) => {
    const { name, username, email, preferredCurrency } = req.body;
    const userId = req.userId;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check username uniqueness if being updated
        if (username && username !== user.username) {
            const existingUsername = await User.findOne({ username });
            if (existingUsername) {
                return res.status(400).json({ message: "Username already exists" });
            }
            user.username = username;
        }

        // Check email uniqueness if being updated
        if (email && email !== user.email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({ message: "Email already exists" });
            }
            user.email = email;
        }

        // Update name if provided
        if (name) {
            user.name = name;
        }

        // Update preferred currency if provided
        if (preferredCurrency) {
            user.preferredCurrency = preferredCurrency;
        }

        await user.save();

        // Return user without password
        const updatedUser = await User.findById(userId).select("-password");
        const userResponse = {
            id: updatedUser._id,
            name: updatedUser.name,
            username: updatedUser.username,
            email: updatedUser.email,
            preferredCurrency: updatedUser.preferredCurrency,
            upiId: updatedUser.upiId,
            profileImage: updatedUser.profileImage || { url: null, publicId: null },
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt
        };
        return res.status(200).json({
            message: "Profile updated successfully",
            user: userResponse
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};

// Upload profile image
export const uploadProfileImage = async (req, res) => {
    const userId = req.userId;

    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Delete old image from Cloudinary if exists
        if (user.profileImage && user.profileImage.publicId) {
            await cloudinary.uploader.destroy(user.profileImage.publicId);
        }

        // Save new image info
        user.profileImage = {
            url: req.file.path,
            publicId: req.file.filename
        };

        await user.save();

        // Return user without password
        const updatedUser = await User.findById(userId).select("-password");
        const userResponse = {
            id: updatedUser._id,
            name: updatedUser.name,
            username: updatedUser.username,
            email: updatedUser.email,
            preferredCurrency: updatedUser.preferredCurrency,
            upiId: updatedUser.upiId,
            profileImage: updatedUser.profileImage || { url: null, publicId: null },
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt
        };
        return res.status(200).json({
            message: "Profile image uploaded successfully",
            user: userResponse
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};

// Delete profile image
export const deleteProfileImage = async (req, res) => {
    const userId = req.userId;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.profileImage || !user.profileImage.publicId) {
            return res.status(404).json({ message: "No profile image to delete" });
        }

        // Delete from Cloudinary
        await cloudinary.uploader.destroy(user.profileImage.publicId);

        // Clear from database
        user.profileImage = {
            url: null,
            publicId: null
        };

        await user.save();

        // Return user without password
        const updatedUser = await User.findById(userId).select("-password");
        const userResponse = {
            id: updatedUser._id,
            name: updatedUser.name,
            username: updatedUser.username,
            email: updatedUser.email,
            preferredCurrency: updatedUser.preferredCurrency,
            upiId: updatedUser.upiId,
            profileImage: updatedUser.profileImage || { url: null, publicId: null },
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt
        };
        return res.status(200).json({
            message: "Profile image deleted successfully",
            user: userResponse
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};

// Search users (for adding friends)
export const searchUsers = async (req, res) => {
    const { query } = req.query;
    const userId = req.userId;

    try {
        if (!query || query.trim() === '') {
            return res.status(400).json({ message: "Search query is required" });
        }

        // Sanitize regex input to prevent NoSQL injection and regex DoS
        const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const sanitizedQuery = escapeRegex(query.trim());

        // Exclude current user and users who are already friends
        const friendships = await Friend.find({
            $or: [
                { userId, status: 'accepted' },
                { friendId: userId, status: 'accepted' }
            ]
        });

        const friendIds = friendships.map(f =>
            f.userId.toString() === userId ? f.friendId : f.userId
        );
        const excludeUserIds = [userId, ...friendIds];

        const users = await User.find({
            _id: { $nin: excludeUserIds },
            $or: [
                { username: { $regex: sanitizedQuery, $options: 'i' } },
                { name: { $regex: sanitizedQuery, $options: 'i' } }
            ]
        })
            .select('username name email profileImage')
            .limit(10);

        return res.status(200).json({
            users: users.map(user => ({
                _id: user._id,
                username: user.username,
                name: user.name,
                email: user.email,
                profileImage: user.profileImage || { url: null, publicId: null }
            }))
        });
    } catch (error) {
        console.error('Error in searchUsers:', error.message);
        return res.status(500).json({ message: "Server error" });
    }
};

// Delete user account
export const deleteAccount = async (req, res) => {
    const userId = req.userId;
    const { password } = req.body;

    try {
        // Get user with password for verification
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Verify password
        if (!password) {
            return res.status(400).json({ message: "Password is required" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Incorrect password" });
        }

        // Check for outstanding balances
        const outstandingBalances = await Balance.find({
            $or: [
                { fromUserId: userId, amount: { $gt: 0 } },
                { toUserId: userId, amount: { $gt: 0 } }
            ]
        });

        if (outstandingBalances.length > 0) {
            return res.status(400).json({
                message: "Cannot delete account with outstanding balances. Please settle all debts first."
            });
        }

        // Delete profile image from Cloudinary if exists
        if (user.profileImage && user.profileImage.publicId) {
            try {
                await cloudinary.uploader.destroy(user.profileImage.publicId);
            } catch (error) {
                console.error('Failed to delete Cloudinary image:', error.message);
            }
        }

        // Delete all user's activities
        await Activity.deleteMany({ userId });

        // Delete all friendships
        await Friend.deleteMany({
            $or: [
                { userId },
                { friendId: userId }
            ]
        });

        // Remove user from groups and delete groups where user is the only member
        const userGroups = await Group.find({ 'members.userId': userId });

        for (const group of userGroups) {
            if (group.members.length === 1) {
                // User is the only member, delete the group and all related data
                await Expense.deleteMany({ groupId: group._id });
                await Settlement.deleteMany({ groupId: group._id });
                await Balance.deleteMany({ groupId: group._id });
                await Activity.deleteMany({ groupId: group._id });
                await Group.findByIdAndDelete(group._id);
            } else {
                // Remove user from group
                group.members = group.members.filter(
                    member => member.userId.toString() !== userId
                );
                await group.save();
            }
        }

        // Delete expenses where user was the payer
        const userExpenses = await Expense.find({ paidBy: userId });
        for (const expense of userExpenses) {
            await Activity.deleteMany({ expenseId: expense._id });
            await Expense.findByIdAndDelete(expense._id);
        }

        // Delete settlements involving the user
        await Settlement.deleteMany({
            $or: [
                { paidBy: userId },
                { paidTo: userId }
            ]
        });

        // Delete balances involving the user
        await Balance.deleteMany({
            $or: [
                { fromUserId: userId },
                { toUserId: userId }
            ]
        });

        // Finally, delete the user account
        await User.findByIdAndDelete(userId);

        return res.status(200).json({
            message: "Account deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};
// Update UPI ID
export const updateUpiId = async (req, res) => {
    try {
        const { upiId } = req.body;
        const userId = req.userId;

        // Validate UPI ID format if provided
        if (upiId) {
            const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
            if (!upiRegex.test(upiId)) {
                return res.status(400).json({
                    message: 'Invalid UPI ID format. Use format: username@provider (e.g., john@paytm, alice@hdfcbank)'
                });
            }
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { upiId: upiId || null },
            { new: true, runValidators: true }
        ).select('-password');

        const userResponse = {
            id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            preferredCurrency: user.preferredCurrency,
            upiId: user.upiId,
            profileImage: user.profileImage || { url: null, publicId: null },
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };
        return res.status(200).json({
            message: upiId ? 'UPI ID updated successfully' : 'UPI ID removed successfully',
            user: userResponse
        });
    } catch (error) {
        return res.status(500).json({ message: "Failed to update UPI ID" });
    }
};
