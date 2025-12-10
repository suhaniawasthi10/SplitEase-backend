import mongoose from "mongoose";

const activitySchema = mongoose.Schema({
    activityType: {
        type: String,
        enum: [
            'expense_added',
            'expense_edited',
            'expense_deleted',
            'settlement_added',
            'friend_request_sent',
            'friend_request_accepted',
            'friend_removed',
            'group_created',
            'group_updated',
            'group_member_added',
            'group_member_removed',
            'group_deleted'
        ],
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    targetUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null,
        index: true
    },
    expenseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Expense',
        default: null
    },
    settlementId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Settlement',
        default: null
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    description: {
        type: String,
        default: '',
        trim: true
    }
}, { timestamps: true });

// Indexes for optimization
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ groupId: 1, createdAt: -1 });
activitySchema.index({ activityType: 1, createdAt: -1 });

const Activity = mongoose.model('Activity', activitySchema);
export default Activity;
