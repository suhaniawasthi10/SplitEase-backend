import Expense from "../models/expense.js";
import Balance from "../models/balance.js";
import Group from "../models/group.js";
import User from "../models/user.js";
import Activity from "../models/activity.js";
import mongoose from "mongoose";


// Helper function to calculate balance updates from expense
const calculateBalanceUpdates = (expense) => {
  const updates = [];
  const paidBy = expense.paidBy.toString();

  expense.participants.forEach(participant => {
    const participantId = participant.userId.toString();
    const share = participant.share;

    if (participantId === paidBy) return;

    updates.push({
      fromUserId: participantId,
      toUserId: paidBy,
      amount: share,
      groupId: expense.groupId
    });
  });

  return updates;
};

// Apply balance updates
const applyBalanceUpdates = async (updates, session) => {
  for (const u of updates) {
    await Balance.updateBalance(
      u.fromUserId,
      u.toUserId,
      u.amount,
      u.groupId,
      session
    );
  }
};

// ✅ FIXED: Revert balance updates (swap users, keep amount positive)
const revertBalanceUpdates = async (updates, session) => {
  for (const u of updates) {
    await Balance.updateBalance(
      u.toUserId,
      u.fromUserId,
      u.amount,
      u.groupId,
      session
    );
  }
};

// ================= CREATE EXPENSE =================
export const createExpense = async (req, res) => {
  const { description, amount, splitType, participants, groupId, category, notes, date } = req.body;
  const userId = req.userId;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!description || !amount || !participants?.length) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Amount must be positive" });
    }

    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Group not found" });
      }

      const isMember = group.members.some(m => m.userId.toString() === userId);
      if (!isMember) {
        await session.abortTransaction();
        return res.status(403).json({ message: "Not a group member" });
      }
    }

    // ===== SPLIT CALCULATION =====
    let processedParticipants = [];
    const totalParticipants = participants.length;

    if (splitType === "exact") {
      const totalShares = participants.reduce((s, p) => s + (p.share || 0), 0);
      if (Math.abs(totalShares - amount) > 0.01) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Exact shares must sum to amount" });
      }
      processedParticipants = participants;
    } else if (splitType === "percentage") {
      const totalPct = participants.reduce((s, p) => s + (p.share || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Percentages must sum to 100" });
      }
      processedParticipants = participants.map(p => ({
        userId: p.userId,
        share: (p.share / 100) * amount
      }));
    } else {
      const share = amount / totalParticipants;
      processedParticipants = participants.map(p => ({
        userId: p.userId,
        share
      }));
    }

    const [expense] = await Expense.create(
      [{
        description,
        amount,
        paidBy: userId,
        splitType: splitType || "equal",
        participants: processedParticipants,
        groupId: groupId || null,
        category: category || "general",
        notes: notes || "",
        date: date || Date.now(),
        createdBy: userId
      }],
      { session }
    );

    const balanceUpdates = calculateBalanceUpdates(expense);
    await applyBalanceUpdates(balanceUpdates, session);

    await Activity.create(
      [{
        activityType: "expense_added",
        userId,
        groupId: groupId || null,
        expenseId: expense._id,
        description: `Added expense: ${description}`,
        metadata: { amount, category }
      }],
      { session }
    );

    await session.commitTransaction();

    return res.status(201).json({ message: "Expense created", expense });
  } catch (e) {
    await session.abortTransaction();
    return res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
};

// ================= GET EXPENSES =================
export const getExpenses = async (req, res) => {
  const userId = req.userId;
  const { groupId } = req.query;

  // Validate and limit pagination parameters to prevent abuse
  const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100
  const skip = Math.max(parseInt(req.query.skip) || 0, 0); // Min 0

  try {
    const query = {};

    if (groupId) {
      query.groupId = groupId;
    } else {
      // Get all expenses where user is payer or participant
      query.$or = [
        { paidBy: userId },
        { 'participants.userId': userId }
      ];
    }

    const expenses = await Expense.find(query)
      .populate('paidBy', 'username name email')
      .populate('participants.userId', 'username name email')
      .populate('groupId', 'name')
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Expense.countDocuments(query);

    return res.status(200).json({
      count: expenses.length,
      total,
      expenses
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// ================= GET EXPENSE DETAILS =================
export const getExpenseDetails = async (req, res) => {
  const { expenseId } = req.params;
  const userId = req.userId;

  try {
    const expense = await Expense.findById(expenseId)
      .populate('paidBy', 'username name email profileImage')
      .populate('participants.userId', 'username name email profileImage')
      .populate('groupId', 'name');

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Check if user has access
    const hasAccess = expense.paidBy._id.toString() === userId ||
      expense.participants.some(p => p.userId._id.toString() === userId);

    if (!hasAccess) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    return res.status(200).json({ expense });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// ================= EDIT EXPENSE =================
export const editExpense = async (req, res) => {
  const { expenseId } = req.params;
  const { description, amount, category, notes, date } = req.body;
  const userId = req.userId;

  try {
    const expense = await Expense.findById(expenseId);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Only creator can edit
    if (expense.createdBy.toString() !== userId) {
      return res.status(403).json({ message: "Only creator can edit expense" });
    }

    // Update fields
    if (description) expense.description = description;
    if (amount) expense.amount = amount;
    if (category) expense.category = category;
    if (notes !== undefined) expense.notes = notes;
    if (date) expense.date = date;

    await expense.save();

    // Log activity
    await Activity.create({
      activityType: "expense_edited",
      userId,
      groupId: expense.groupId,
      expenseId: expense._id,
      description: `Edited expense: ${expense.description}`
    });

    return res.status(200).json({ message: "Expense updated", expense });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// ================= DELETE EXPENSE =================
export const deleteExpense = async (req, res) => {
  const { expenseId } = req.params;
  const userId = req.userId;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const expense = await Expense.findById(expenseId).session(session);

    if (!expense) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Expense not found" });
    }

    // Only creator can delete
    if (expense.createdBy.toString() !== userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "Only creator can delete expense" });
    }

    // Revert balance updates
    const balanceUpdates = calculateBalanceUpdates(expense);
    await revertBalanceUpdates(balanceUpdates, session);

    // Delete expense
    await Expense.findByIdAndDelete(expenseId).session(session);

    // Log activity
    await Activity.create(
      [{
        activityType: "expense_deleted",
        userId,
        groupId: expense.groupId,
        description: `Deleted expense: ${expense.description}`
      }],
      { session }
    );

    await session.commitTransaction();

    return res.status(200).json({ message: "Expense deleted" });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
};

// ================= CHANGE PAYER =================
export const changePayer = async (req, res) => {
  const { expenseId } = req.params;
  const { newPayerId } = req.body;
  const userId = req.userId;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const expense = await Expense.findById(expenseId).session(session);

    if (!expense) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Expense not found" });
    }

    // Only creator can change payer
    if (expense.createdBy.toString() !== userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "Only creator can change payer" });
    }

    // Revert old balance updates
    const oldBalanceUpdates = calculateBalanceUpdates(expense);
    await revertBalanceUpdates(oldBalanceUpdates, session);

    // Update payer
    expense.paidBy = newPayerId;
    await expense.save({ session });

    // Apply new balance updates
    const newBalanceUpdates = calculateBalanceUpdates(expense);
    await applyBalanceUpdates(newBalanceUpdates, session);

    // Log activity
    await Activity.create(
      [{
        activityType: "expense_edited",
        userId,
        groupId: expense.groupId,
        expenseId: expense._id,
        description: `Changed payer for expense: ${expense.description}`
      }],
      { session }
    );

    await session.commitTransaction();

    return res.status(200).json({ message: "Payer changed", expense });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
};
