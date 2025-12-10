import mongoose from "mongoose";
import crypto from "crypto";

const groupInviteSchema = mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true,
        index: true
    },
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    invitedEmail: {
        type: String,
        default: null,
        trim: true,
        lowercase: true
    },
    invitedUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'expired'],
        default: 'pending',
        index: true
    },
    token: {
        type: String,
        default: null,
        unique: true,
        sparse: true,
        index: true
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        index: true
    }
}, { timestamps: true });

// Generate a unique token for email invites
groupInviteSchema.methods.generateToken = function() {
    this.token = crypto.randomBytes(32).toString('hex');
    return this.token;
};

// Check if invite is expired
groupInviteSchema.methods.isExpired = function() {
    return this.expiresAt < new Date();
};

// Indexes for optimization
groupInviteSchema.index({ token: 1, status: 1 });
groupInviteSchema.index({ invitedEmail: 1, groupId: 1, status: 1 });
groupInviteSchema.index({ invitedUserId: 1, groupId: 1, status: 1 });

const GroupInvite = mongoose.model('GroupInvite', groupInviteSchema);
export default GroupInvite;
