import Friend from "../models/friend.js";
import User from "../models/user.js";
import Activity from "../models/activity.js";
import mongoose from "mongoose";

// Send a friend request
export const sendFriendRequest = async (req, res) => {
    const { friendUsername } = req.body;
    const userId = req.userId;

    try {
        if (!friendUsername) {
            return res.status(400).json({ message: "Friend username is required" });
        }

        // Find the friend by username
        const friend = await User.findOne({ username: friendUsername });
        if (!friend) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if trying to add themselves
        if (friend._id.toString() === userId) {
            return res.status(400).json({ message: "You cannot send a friend request to yourself" });
        }

        // Check if friendship already exists
        const existingFriend = await Friend.findOne({
            $or: [
                { userId, friendId: friend._id },
                { userId: friend._id, friendId: userId }
            ]
        });

        if (existingFriend) {
            if (existingFriend.status === 'pending') {
                return res.status(400).json({ message: "Friend request already sent" });
            } else if (existingFriend.status === 'accepted') {
                return res.status(400).json({ message: "You are already friends" });
            } else if (existingFriend.status === 'rejected') {
                // Allow resending after rejection
                existingFriend.status = 'pending';
                existingFriend.requestedBy = userId;
                await existingFriend.save();

                return res.status(200).json({
                    message: "Friend request sent successfully",
                    friendRequest: existingFriend
                });
            }
        }

        // Create new friend request (bidirectional)
        const friendRequest = await Friend.create({
            userId,
            friendId: friend._id,
            status: 'pending',
            requestedBy: userId
        });

        return res.status(201).json({
            message: "Friend request sent successfully",
            friendRequest
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};

// Accept a friend request
export const acceptFriendRequest = async (req, res) => {
    const { requestId } = req.params;
    const userId = req.userId;

    try {
        const friendRequest = await Friend.findById(requestId);
        if (!friendRequest) {
            return res.status(404).json({ message: "Friend request not found" });
        }

        // Verify the request is for the current user
        if (friendRequest.friendId.toString() !== userId) {
            return res.status(403).json({ message: "You are not authorized to accept this request" });
        }

        // Check if already accepted
        if (friendRequest.status === 'accepted') {
            return res.status(400).json({ message: "Friend request already accepted" });
        }

        // Update status to accepted
        friendRequest.status = 'accepted';
        await friendRequest.save();

        return res.status(200).json({
            message: "Friend request accepted",
            friendRequest
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};

// Reject a friend request
export const rejectFriendRequest = async (req, res) => {
    const { requestId } = req.params;
    const userId = req.userId;

    try {
        const friendRequest = await Friend.findById(requestId);
        if (!friendRequest) {
            return res.status(404).json({ message: "Friend request not found" });
        }

        // Verify the request is for the current user
        if (friendRequest.friendId.toString() !== userId) {
            return res.status(403).json({ message: "You are not authorized to reject this request" });
        }

        // Update status to rejected
        friendRequest.status = 'rejected';
        await friendRequest.save();

        return res.status(200).json({
            message: "Friend request rejected",
            friendRequest
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};

// Get friends list
export const getFriendsList = async (req, res) => {
    const userId = req.userId;

    try {
        // Find all accepted friendships
        const friendships = await Friend.find({
            $or: [
                { userId, status: 'accepted' },
                { friendId: userId, status: 'accepted' }
            ]
        }).populate('userId friendId', 'username name email profileImage');

        // Extract friend details
        const friends = friendships.map(friendship => {
            // Compare ObjectIds as strings to identify the other person
            const isUserIdMatch = friendship.userId._id.toString() === userId.toString();
            const friend = isUserIdMatch ? friendship.friendId : friendship.userId;

            return {
                _id: friend._id,
                username: friend.username,
                name: friend.name,
                email: friend.email,
                profileImage: friend.profileImage,
                friendshipId: friendship._id,
                since: friendship.updatedAt
            };
        });

        return res.status(200).json({
            count: friends.length,
            friends
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};

// Get pending friend requests
export const getPendingRequests = async (req, res) => {
    const userId = req.userId;

    try {
        // Find all pending requests where user is the recipient
        const pendingRequests = await Friend.find({
            friendId: userId,
            status: 'pending'
        }).populate('userId', 'username name email profileImage');

        // Find all pending requests sent by the user
        const sentRequests = await Friend.find({
            userId,
            status: 'pending'
        }).populate('friendId', 'username name email profileImage');

        return res.status(200).json({
            received: pendingRequests.map(req => ({
                _id: req._id,
                from: {
                    _id: req.userId._id,
                    username: req.userId.username,
                    name: req.userId.name,
                    email: req.userId.email
                },
                createdAt: req.createdAt
            })),
            sent: sentRequests.map(req => ({
                _id: req._id,
                to: {
                    _id: req.friendId._id,
                    username: req.friendId.username,
                    name: req.friendId.name,
                    email: req.friendId.email
                },
                createdAt: req.createdAt
            }))
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};

// Search friends by username
export const searchFriends = async (req, res) => {
    const { username } = req.query;
    const userId = req.userId;

    try {
        if (!username || username.trim() === '') {
            return res.status(400).json({ message: "Username query is required" });
        }

        // Find all accepted friendships
        const friendships = await Friend.find({
            $or: [
                { userId, status: 'accepted' },
                { friendId: userId, status: 'accepted' }
            ]
        }).populate('userId friendId', 'username name email profileImage');

        // Extract friend IDs
        const friendIds = friendships.map(friendship => {
            return friendship.userId._id.toString() === userId
                ? friendship.friendId._id.toString()
                : friendship.userId._id.toString();
        });

        // Search within friends by username (case-insensitive partial match)
        const searchResults = friendships
            .map(friendship => {
                const friend = friendship.userId._id.toString() === userId
                    ? friendship.friendId
                    : friendship.userId;
                return friend;
            })
            .filter(friend =>
                friend.username.toLowerCase().includes(username.toLowerCase())
            )
            .map(friend => ({
                _id: friend._id,
                username: friend.username,
                name: friend.name,
                email: friend.email
            }));

        return res.status(200).json({
            count: searchResults.length,
            friends: searchResults
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};

// Remove a friend
export const removeFriend = async (req, res) => {
    const { friendId } = req.params;
    const userId = req.userId;

    try {
        // Find and delete the friendship
        const friendship = await Friend.findOneAndDelete({
            $or: [
                { userId, friendId, status: 'accepted' },
                { userId: friendId, friendId: userId, status: 'accepted' }
            ]
        });

        if (!friendship) {
            return res.status(404).json({ message: "Friendship not found" });
        }

        return res.status(200).json({
            message: "Friend removed successfully"
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};
