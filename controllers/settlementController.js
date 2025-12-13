import Settlement from "../models/settlement.js";
import Balance from "../models/balance.js";
import User from "../models/user.js";
import Activity from "../models/activity.js";
import mongoose from "mongoose";

// Create settlement
export const createSettlement = async (req, res) => {
  const { paidTo, amount, groupId, note } = req.body;
  const userId = req.userId;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validation
    if (!paidTo || !amount) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Paid to and amount are required" });
    }

    if (amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Amount must be positive" });
    }

    if (userId === paidTo) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Cannot settle with yourself" });
    }

    // Check if paidTo user exists
    const recipient = await User.findById(paidTo);
    if (!recipient) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Recipient user not found" });
    }

    // Create settlement
    const settlement = await Settlement.create([{
      paidBy: userId,
      paidTo,
      amount,
      groupId: groupId || null,
      note: note || ''
    }], { session });

    // Update balance using the new settleAmount method with validation
    let settlementResult;
    try {
      settlementResult = await Balance.settleAmount(
        userId,        // payer
        paidTo,        // recipient
        amount,        // settlement amount
        groupId || null,
        session
      );
    } catch (error) {
      await session.abortTransaction();
      // Delete the settlement record we just created since balance update failed
      await Settlement.findByIdAndDelete(settlement[0]._id).session(session);
      return res.status(400).json({
        message: error.message || "Invalid settlement amount"
      });
    }

    // Log activity
    await Activity.create([{
      activityType: 'settlement_added',
      userId,
      targetUserId: paidTo,
      groupId: groupId || null,
      settlementId: settlement[0]._id,
      description: `Settled ${amount} with ${recipient.username}`,
      metadata: {
        amount,
        previousDebt: settlementResult.previousDebt,
        remainingDebt: settlementResult.remainingDebt
      }
    }], { session });

    await session.commitTransaction();

    const populatedSettlement = await Settlement.findById(settlement[0]._id)
      .populate('paidBy', 'username name email')
      .populate('paidTo', 'username name email');

    return res.status(201).json({
      message: settlementResult.remainingDebt > 0
        ? `Settlement recorded. You still owe $${settlementResult.remainingDebt.toFixed(2)}`
        : "Settlement recorded. Debt fully paid!",
      settlement: populatedSettlement,
      settlementDetails: {
        previousDebt: parseFloat(settlementResult.previousDebt.toFixed(2)),
        settledAmount: parseFloat(settlementResult.settledAmount.toFixed(2)),
        remainingDebt: parseFloat(settlementResult.remainingDebt.toFixed(2))
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in createSettlement:', error.message);
    console.error('Stack:', error.stack);
    return res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    session.endSession();
  }
};

// Get settlements
export const getSettlements = async (req, res) => {
  const userId = req.userId;
  const { groupId, limit = 50, skip = 0 } = req.query;

  try {
    const query = {
      $or: [
        { paidBy: userId },
        { paidTo: userId }
      ]
    };

    if (groupId) {
      query.groupId = groupId;
    }

    const settlements = await Settlement.find(query)
      .populate('paidBy', 'username name email')
      .populate('paidTo', 'username name email')
      .sort({ settledAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Settlement.countDocuments(query);

    return res.status(200).json({
      count: settlements.length,
      total,
      settlements
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// Get dashboard summary (optimized)
export const getDashboardSummary = async (req, res) => {
  const userId = req.userId;

  try {
    // Use the optimized static method from Balance model
    const summary = await Balance.getBalanceSummary(userId);

    return res.status(200).json({
      youOwe: parseFloat(summary.youOwe.toFixed(2)),
      youreOwed: parseFloat(summary.youreOwed.toFixed(2)),
      netBalance: parseFloat(summary.netBalance.toFixed(2)),
      owedCount: summary.owedCount,
      owedByCount: summary.owedByCount
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// Get settlements for a specific group
export const getGroupSettlements = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.userId;
  const { limit = 50, skip = 0 } = req.query;

  try {
    const settlements = await Settlement.find({ groupId })
      .populate('paidBy', 'username name email')
      .populate('paidTo', 'username name email')
      .sort({ settledAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Settlement.countDocuments({ groupId });

    return res.status(200).json({
      count: settlements.length,
      total,
      settlements
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// Get detailed balances
export const getDetailedBalances = async (req, res) => {
  const userId = req.userId;

  try {
    // Get balances where user owes others
    const youOwe = await Balance.find({
      fromUserId: userId,
      amount: { $gt: 0 }
    })
      .populate('toUserId', 'username name email upiId')
      .populate('groupId', 'name');

    // Get balances where others owe user
    const youreOwed = await Balance.find({
      toUserId: userId,
      amount: { $gt: 0 }
    })
      .populate('fromUserId', 'username name email upiId')
      .populate('groupId', 'name');

    return res.status(200).json({
      youOwe: youOwe.map(b => ({
        user: b.toUserId,
        amount: parseFloat(b.amount.toFixed(2)),
        group: b.groupId,
        lastUpdated: b.lastUpdated
      })),
      youreOwed: youreOwed.map(b => ({
        user: b.fromUserId,
        amount: parseFloat(b.amount.toFixed(2)),
        group: b.groupId,
        lastUpdated: b.lastUpdated
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};
