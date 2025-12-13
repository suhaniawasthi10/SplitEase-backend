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
// Include groupId in unique index to allow same users in different groups
balanceSchema.index({ fromUserId: 1, toUserId: 1, groupId: 1 }, { unique: true });
balanceSchema.index({ fromUserId: 1, amount: 1 }); // For dashboard summary
balanceSchema.index({ toUserId: 1, amount: 1 }); // For dashboard summary
balanceSchema.index({ groupId: 1, fromUserId: 1, toUserId: 1 });

// Static method to update balance incrementally
balanceSchema.statics.updateBalance = async function (fromUserId, toUserId, amountChange, groupId = null, session = null) {
  const options = session ? { session, upsert: true, new: true } : { upsert: true, new: true };

  // Find existing balance or create new one
  // Match on fromUserId, toUserId, AND groupId to align with unique index
  const balance = await this.findOneAndUpdate(
    { fromUserId, toUserId, groupId },
    {
      $inc: { amount: amountChange },
      $set: { lastUpdated: new Date() }
    },
    options
  );

  return balance;
};

// Static method to handle settlements with validation
balanceSchema.statics.settleAmount = async function (payerId, recipientId, settlementAmount, groupId = null, session = null) {
  // A settlement means: payer is paying money to recipient
  // This reduces the debt that payer owes to recipient

  // Build query - if groupId is specified, filter by it; otherwise get all balances between these users
  const baseQueryPayerOwes = { fromUserId: payerId, toUserId: recipientId };
  const baseQueryRecipientOwes = { fromUserId: recipientId, toUserId: payerId };

  if (groupId !== null) {
    // Specific group settlement
    baseQueryPayerOwes.groupId = groupId;
    baseQueryRecipientOwes.groupId = groupId;
  }

  // Find all balance records where payer owes recipient
  const payerOwesBalances = await this.find(baseQueryPayerOwes).session(session);

  // Find all balance records where recipient owes payer (cross-debt)
  const recipientOwesBalances = await this.find(baseQueryRecipientOwes).session(session);

  // Calculate total owed in each direction
  const totalPayerOwes = payerOwesBalances.reduce((sum, b) => sum + (b.amount > 0 ? b.amount : 0), 0);
  const totalRecipientOwes = recipientOwesBalances.reduce((sum, b) => sum + (b.amount > 0 ? b.amount : 0), 0);

  // Calculate net debt (positive means payer owes recipient)
  const netDebt = totalPayerOwes - totalRecipientOwes;

  // Validation: Cannot settle if you don't owe anything
  if (netDebt <= 0) {
    throw new Error(`You don't owe money to this person. ${netDebt < 0 ? `They owe you $${Math.abs(netDebt).toFixed(2)}` : 'Balance is settled'}`);
  }

  if (settlementAmount > netDebt) {
    throw new Error(`Cannot settle $${settlementAmount}. You only owe $${netDebt.toFixed(2)}`);
  }

  // Apply the settlement by reducing the payer's debt
  // Distribute the settlement across balance records (starting from largest debts)
  let remainingToSettle = settlementAmount;
  const sortedBalances = payerOwesBalances
    .filter(b => b.amount > 0)
    .sort((a, b) => b.amount - a.amount); // Largest first

  for (const balance of sortedBalances) {
    if (remainingToSettle <= 0) break;

    const amountToDeduct = Math.min(balance.amount, remainingToSettle);
    const newAmount = balance.amount - amountToDeduct;

    await this.findOneAndUpdate(
      { _id: balance._id },
      {
        $set: {
          amount: newAmount,
          lastUpdated: new Date()
        }
      },
      { session }
    );

    remainingToSettle -= amountToDeduct;
  }

  return {
    settledAmount: settlementAmount,
    previousDebt: netDebt,
    remainingDebt: Math.max(0, netDebt - settlementAmount)
  };
};

// Static method to get user's net balance summary
balanceSchema.statics.getBalanceSummary = async function (userId) {
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
              {
                $and: [
                  { $eq: ['$fromUserId', new mongoose.Types.ObjectId(userId)] },
                  { $gt: ['$amount', 0] }
                ]
              },
              '$amount',
              0
            ]
          }
        },
        youreOwed: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$toUserId', new mongoose.Types.ObjectId(userId)] },
                  { $gt: ['$amount', 0] }
                ]
              },
              '$amount',
              0
            ]
          }
        },
        owedCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$fromUserId', new mongoose.Types.ObjectId(userId)] },
                  { $gt: ['$amount', 0] }
                ]
              },
              1,
              0
            ]
          }
        },
        owedByCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$toUserId', new mongoose.Types.ObjectId(userId)] },
                  { $gt: ['$amount', 0] }
                ]
              },
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
