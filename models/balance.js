import mongoose from "mongoose";

const balanceSchema = mongoose.Schema({
    fromUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    toUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        default: 0
        // Positive: fromUser owes toUser
        // Negative: toUser owes fromUser
        // Zero: settled/no balance
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null,
        index: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Compound indexes for ultra-fast queries
balanceSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });
balanceSchema.index({ fromUserId: 1, amount: 1 }); // For dashboard summary
balanceSchema.index({ toUserId: 1, amount: 1 }); // For dashboard summary
balanceSchema.index({ groupId: 1, fromUserId: 1, toUserId: 1 });

// Static method to update balance incrementally
balanceSchema.statics.updateBalance = async function(fromUserId, toUserId, amountChange, groupId = null, session = null) {
    const options = session ? { session, upsert: true, new: true } : { upsert: true, new: true };
    
    // Find existing balance or create new one
    const balance = await this.findOneAndUpdate(
        { fromUserId, toUserId },
        {
            $inc: { amount: amountChange },
            $set: { lastUpdated: new Date(), groupId }
        },
        options
    );
    
    return balance;
};

// Static method to get user's net balance summary
balanceSchema.statics.getBalanceSummary = async function(userId) {
    const result = await this.aggregate([
        {
            $match: {
                $or: [
                    { fromUserId: new mongoose.Types.ObjectId(userId) },
                    { toUserId: new mongoose.Types.ObjectId(userId) }
                ]
            }
        },
        {
            $group: {
                _id: null,
                youOwe: {
                    $sum: {
                        $cond: [
                            { $and: [
                                { $eq: ['$fromUserId', new mongoose.Types.ObjectId(userId)] },
                                { $gt: ['$amount', 0] }
                            ]},
                            '$amount',
                            0
                        ]
                    }
                },
                youreOwed: {
                    $sum: {
                        $cond: [
                            { $and: [
                                { $eq: ['$toUserId', new mongoose.Types.ObjectId(userId)] },
                                { $gt: ['$amount', 0] }
                            ]},
                            '$amount',
                            0
                        ]
                    }
                },
                owedCount: {
                    $sum: {
                        $cond: [
                            { $and: [
                                { $eq: ['$fromUserId', new mongoose.Types.ObjectId(userId)] },
                                { $gt: ['$amount', 0] }
                            ]},
                            1,
                            0
                        ]
                    }
                },
                owedByCount: {
                    $sum: {
                        $cond: [
                            { $and: [
                                { $eq: ['$toUserId', new mongoose.Types.ObjectId(userId)] },
                                { $gt: ['$amount', 0] }
                            ]},
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);
    
    if (result.length === 0) {
        return {
            youOwe: 0,
            youreOwed: 0,
            netBalance: 0,
            owedCount: 0,
            owedByCount: 0
        };
    }
    
    const summary = result[0];
    return {
        youOwe: summary.youOwe || 0,
        youreOwed: summary.youreOwed || 0,
        netBalance: (summary.youreOwed || 0) - (summary.youOwe || 0),
        owedCount: summary.owedCount || 0,
        owedByCount: summary.owedByCount || 0
    };
};

const Balance = mongoose.model('Balance', balanceSchema);
export default Balance;
