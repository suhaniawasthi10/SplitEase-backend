import mongoose from "mongoose";

const groupSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: '',
        trim: true
    },
    category: {
        type: String,
        enum: ['trip', 'home', 'couple', 'other'],
        default: 'other',
        trim: true
    },
    members: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        role: {
            type: String,
            enum: ['owner', 'admin', 'member'],
            default: 'member',
            required: true
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    memberInvitesAllowed: {
        type: Boolean,
        default: false // Only owner/admin can add members by default
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

// Indexes for optimization
groupSchema.index({ 'members.userId': 1 });
groupSchema.index({ createdBy: 1 });

const Group = mongoose.model('Group', groupSchema);
export default Group;
