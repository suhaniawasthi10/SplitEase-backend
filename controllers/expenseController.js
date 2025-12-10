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
    
    // For each participant, calculate how much they owe the payer
    expense.participants.forEach(participant => {
        const participantId = participant.userId.toString();
        const share = participant.share;
        
        // Skip if participant is the payer
        if (participantId === paidBy) return;
        
        // Participant owes payer the share amount
        updates.push({
            fromUserId: participantId,
            toUserId: paidBy,
            amount: share,
            groupId: expense.groupId
        });
    });
    
    return updates;
};

// Helper function to apply balance updates
const applyBalanceUpdates = async (updates, session) => {
    for (const update of updates) {
        await Balance.updateBalance(
            update.fromUserId,
            update.toUserId,
            update.amount,
            update.groupId,
            session
        );
    }
};

// Helper function to revert balance updates
const revertBalanceUpdates = async (updates, session) => {
    for (const update of updates) {
        await Balance.updateBalance(
            update.fromUserId,
            update.toUserId,
            -update.amount, // Negative to revert
            update.groupId,
            session
        );
    }
};

// Create expense
export const createExpense = async (req, res) => {
    const { description, amount, splitType, participants, groupId, category, notes, date } = req.body;
    const userId = req.userId;
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        // Validation
        if (!description || !amount || !participants || participants.length === 0) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Missing required fields" });
        }
        
        // Validate amount
        if (amount <= 0) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Amount must be positive" });
        }
        
        // If group expense, verify user is a member
        if (groupId) {
            const group = await Group.findById(groupId);
            if (!group) {
                await session.abortTransaction();
                return res.status(404).json({ message: "Group not found" });
            }
            
            const isMember = group.members.some(m => m.userId.toString() === userId);
            if (!isMember) {
                await session.abortTransaction();
                return res.status(403).json({ message: "You are not a member of this group" });
            }
        }
        
        // Calculate shares based on split type
        let processedParticipants = [];
        const totalParticipants = participants.length;
        
        if (splitType === 'equal') {
            const sharePerPerson = amount / totalParticipants;
            processedParticipants = participants.map(p => ({
                userId: p.userId,
                share: sharePerPerson
            }));
        } else if (splitType === 'exact') {
            // Smart exact split: if some participants have shares, calculate remaining for others
            const participantsWithShares = participants.filter(p => p.share !== undefined && p.share > 0);
            const participantsWithoutShares = participants.filter(p => p.share === undefined || p.share === 0);
            
            if (participantsWithShares.length === 0) {
                // No shares provided, divide equally
                const sharePerPerson = amount / totalParticipants;
                processedParticipants = participants.map(p => ({
                    userId: p.userId,
                    share: sharePerPerson
                }));
            } else if (participantsWithoutShares.length === 0) {
                // All participants have shares, validate they sum to amount
                const totalShares = participants.reduce((sum, p) => sum + p.share, 0);
                if (Math.abs(totalShares - amount) > 0.01) {
                    await session.abortTransaction();
                    return res.status(400).json({ 
                        message: "Exact shares must sum to the total amount" 
                    });
                }
                processedParticipants = participants;
            } else {
                // Some have shares, calculate remaining for others
                const assignedAmount = participantsWithShares.reduce((sum, p) => sum + p.share, 0);
                const remainingAmount = amount - assignedAmount;
                
                if (remainingAmount < 0) {
                    await session.abortTransaction();
                    return res.status(400).json({ 
                        message: "Assigned shares exceed total amount" 
                    });
                }
                
                const shareForRemaining = remainingAmount / participantsWithoutShares.length;
                
                processedParticipants = participants.map(p => ({
                    userId: p.userId,
                    share: (p.share !== undefined && p.share > 0) ? p.share : shareForRemaining
                }));
            }
        } else if (splitType === 'percentage') {
            // Smart percentage split: if some participants have percentages, calculate remaining for others
            const participantsWithPercentage = participants.filter(p => p.share !== undefined && p.share > 0);
            const participantsWithoutPercentage = participants.filter(p => p.share === undefined || p.share === 0);
            
            if (participantsWithPercentage.length === 0) {
                // No percentages provided, divide equally
                const percentagePerPerson = 100 / totalParticipants;
                processedParticipants = participants.map(p => ({
                    userId: p.userId,
                    share: (percentagePerPerson / 100) * amount
                }));
            } else if (participantsWithoutPercentage.length === 0) {
                // All participants have percentages, validate they sum to 100
                const totalPercentage = participants.reduce((sum, p) => sum + p.share, 0);
                if (Math.abs(totalPercentage - 100) > 0.01) {
                    await session.abortTransaction();
                    return res.status(400).json({ 
                        message: "Percentages must sum to 100" 
                    });
                }
                // Convert percentages to actual amounts
                processedParticipants = participants.map(p => ({
                    userId: p.userId,
                    share: (p.share / 100) * amount
                }));
            } else {
                // Some have percentages, calculate remaining for others
                const assignedPercentage = participantsWithPercentage.reduce((sum, p) => sum + p.share, 0);
                const remainingPercentage = 100 - assignedPercentage;
                
                if (remainingPercentage < 0) {
                    await session.abortTransaction();
                    return res.status(400).json({ 
                        message: "Assigned percentages exceed 100%" 
                    });
                }
                
                const percentageForRemaining = remainingPercentage / participantsWithoutPercentage.length;
                
                processedParticipants = participants.map(p => {
                    const percentage = (p.share !== undefined && p.share > 0) ? p.share : percentageForRemaining;
                    return {
                        userId: p.userId,
                        share: (percentage / 100) * amount
                    };
                });
            }
        }
        
        // Create expense
        const expense = await Expense.create([{
            description,
            amount,
            paidBy: userId,
            splitType: splitType || 'equal',
            participants: processedParticipants,
            groupId: groupId || null,
            category: category || 'general',
            notes: notes || '',
            date: date || Date.now(),
            createdBy: userId
        }], { session });
        
        // Calculate and apply balance updates
        const balanceUpdates = calculateBalanceUpdates(expense[0]);
        await applyBalanceUpdates(balanceUpdates, session);
        
        // Log activity
        await Activity.create([{
            activityType: 'expense_added',
            userId,
            groupId: groupId || null,
            expenseId: expense[0]._id,
            description: `Added expense: ${description}`,
            metadata: {
                amount,
                category: category || 'general'
            }
        }], { session });
        
        await session.commitTransaction();
        
        const populatedExpense = await Expense.findById(expense[0]._id)
            .populate('paidBy', 'username name email')
            .populate('participants.userId', 'username name email');
        
        return res.status(201).json({
            message: "Expense created successfully",
            expense: populatedExpense
        });
    } catch (error) {
        await session.abortTransaction();
        console.error("Error creating expense:", error);
        return res.status(500).json({ message: "Server error" });
    } finally {
        session.endSession();
    }
};

// Edit expense
export const editExpense = async (req, res) => {
    const { expenseId } = req.params;
    const { description, amount, splitType, participants, category, notes, date } = req.body;
    const userId = req.userId;
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const expense = await Expense.findById(expenseId);
        if (!expense) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Expense not found" });
        }
        
        // Only creator or payer can edit
        if (expense.createdBy.toString() !== userId && expense.paidBy.toString() !== userId) {
            await session.abortTransaction();
            return res.status(403).json({ message: "You don't have permission to edit this expense" });
        }
        
        // Revert old balance updates
        const oldBalanceUpdates = calculateBalanceUpdates(expense);
        await revertBalanceUpdates(oldBalanceUpdates, session);
        
        // Update expense fields
        if (description) expense.description = description;
        if (amount) expense.amount = amount;
        if (splitType) expense.splitType = splitType;
        if (category) expense.category = category;
        if (notes !== undefined) expense.notes = notes;
        if (date) expense.date = date;
        
        // Recalculate shares if participants or amount changed
        if (participants || amount) {
            const newAmount = amount || expense.amount;
            const newParticipants = participants || expense.participants;
            const newSplitType = splitType || expense.splitType;
            const totalParticipants = newParticipants.length;
            
            if (newSplitType === 'equal') {
                const sharePerPerson = newAmount / totalParticipants;
                expense.participants = newParticipants.map(p => ({
                    userId: p.userId,
                    share: sharePerPerson
                }));
            } else if (newSplitType === 'exact') {
                // Smart exact split
                const participantsWithShares = newParticipants.filter(p => p.share !== undefined && p.share > 0);
                const participantsWithoutShares = newParticipants.filter(p => p.share === undefined || p.share === 0);
                
                if (participantsWithShares.length === 0) {
                    const sharePerPerson = newAmount / totalParticipants;
                    expense.participants = newParticipants.map(p => ({
                        userId: p.userId,
                        share: sharePerPerson
                    }));
                } else if (participantsWithoutShares.length === 0) {
                    const totalShares = newParticipants.reduce((sum, p) => sum + p.share, 0);
                    if (Math.abs(totalShares - newAmount) > 0.01) {
                        await session.abortTransaction();
                        return res.status(400).json({ 
                            message: "Exact shares must sum to the total amount" 
                        });
                    }
                    expense.participants = newParticipants;
                } else {
                    const assignedAmount = participantsWithShares.reduce((sum, p) => sum + p.share, 0);
                    const remainingAmount = newAmount - assignedAmount;
                    
                    if (remainingAmount < 0) {
                        await session.abortTransaction();
                        return res.status(400).json({ 
                            message: "Assigned shares exceed total amount" 
                        });
                    }
                    
                    const shareForRemaining = remainingAmount / participantsWithoutShares.length;
                    expense.participants = newParticipants.map(p => ({
                        userId: p.userId,
                        share: (p.share !== undefined && p.share > 0) ? p.share : shareForRemaining
                    }));
                }
            } else if (newSplitType === 'percentage') {
                // Smart percentage split
                const participantsWithPercentage = newParticipants.filter(p => p.share !== undefined && p.share > 0);
                const participantsWithoutPercentage = newParticipants.filter(p => p.share === undefined || p.share === 0);
                
                if (participantsWithPercentage.length === 0) {
                    const percentagePerPerson = 100 / totalParticipants;
                    expense.participants = newParticipants.map(p => ({
                        userId: p.userId,
                        share: (percentagePerPerson / 100) * newAmount
                    }));
                } else if (participantsWithoutPercentage.length === 0) {
                    const totalPercentage = newParticipants.reduce((sum, p) => sum + p.share, 0);
                    if (Math.abs(totalPercentage - 100) > 0.01) {
                        await session.abortTransaction();
                        return res.status(400).json({ 
                            message: "Percentages must sum to 100" 
                        });
                    }
                    expense.participants = newParticipants.map(p => ({
                        userId: p.userId,
                        share: (p.share / 100) * newAmount
                    }));
                } else {
                    const assignedPercentage = participantsWithPercentage.reduce((sum, p) => sum + p.share, 0);
                    const remainingPercentage = 100 - assignedPercentage;
                    
                    if (remainingPercentage < 0) {
                        await session.abortTransaction();
                        return res.status(400).json({ 
                            message: "Assigned percentages exceed 100%" 
                        });
                    }
                    
                    const percentageForRemaining = remainingPercentage / participantsWithoutPercentage.length;
                    expense.participants = newParticipants.map(p => {
                        const percentage = (p.share !== undefined && p.share > 0) ? p.share : percentageForRemaining;
                        return {
                            userId: p.userId,
                            share: (percentage / 100) * newAmount
                        };
                    });
                }
            }
        }
        
        await expense.save({ session });
        
        // Apply new balance updates
        const newBalanceUpdates = calculateBalanceUpdates(expense);
        await applyBalanceUpdates(newBalanceUpdates, session);
        
        // Log activity
        await Activity.create([{
            activityType: 'expense_edited',
            userId,
            groupId: expense.groupId,
            expenseId: expense._id,
            description: `Edited expense: ${expense.description}`,
            metadata: {
                amount: expense.amount,
                category: expense.category
            }
        }], { session });
        
        await session.commitTransaction();
        
        const populatedExpense = await Expense.findById(expenseId)
            .populate('paidBy', 'username name email')
            .populate('participants.userId', 'username name email');
        
        return res.status(200).json({
            message: "Expense updated successfully",
            expense: populatedExpense
        });
    } catch (error) {
        await session.abortTransaction();
        console.error("Error editing expense:", error);
        return res.status(500).json({ message: "Server error" });
    } finally {
        session.endSession();
    }
};

// Delete expense
export const deleteExpense = async (req, res) => {
    const { expenseId } = req.params;
    const userId = req.userId;
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const expense = await Expense.findById(expenseId);
        if (!expense) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Expense not found" });
        }
        
        // Only creator or payer can delete
        if (expense.createdBy.toString() !== userId && expense.paidBy.toString() !== userId) {
            await session.abortTransaction();
            return res.status(403).json({ message: "You don't have permission to delete this expense" });
        }
        
        // Revert balance updates
        const balanceUpdates = calculateBalanceUpdates(expense);
        await revertBalanceUpdates(balanceUpdates, session);
        
        // Delete expense
        await Expense.findByIdAndDelete(expenseId, { session });
        
        // Log activity
        await Activity.create([{
            activityType: 'expense_deleted',
            userId,
            groupId: expense.groupId,
            description: `Deleted expense: ${expense.description}`,
            metadata: {
                amount: expense.amount,
                category: expense.category
            }
        }], { session });
        
        await session.commitTransaction();
        
        return res.status(200).json({
            message: "Expense deleted successfully"
        });
    } catch (error) {
        await session.abortTransaction();
        console.error("Error deleting expense:", error);
        return res.status(500).json({ message: "Server error" });
    } finally {
        session.endSession();
    }
};

// Get expenses
export const getExpenses = async (req, res) => {
    const userId = req.userId;
    const { groupId, limit = 50, skip = 0 } = req.query;
    
    try {
        const query = {
            $or: [
                { paidBy: userId },
                { 'participants.userId': userId }
            ]
        };
        
        if (groupId) {
            query.groupId = groupId;
        }
        
        const expenses = await Expense.find(query)
            .populate('paidBy', 'username name email')
            .populate('participants.userId', 'username name email')
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
        console.error("Error fetching expenses:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

// Change payer on existing expense
export const changePayer = async (req, res) => {
    const { expenseId } = req.params;
    const { newPayerId } = req.body;
    const userId = req.userId;
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const expense = await Expense.findById(expenseId);
        if (!expense) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Expense not found" });
        }
        
        // Only creator or current payer can change payer
        if (expense.createdBy.toString() !== userId && expense.paidBy.toString() !== userId) {
            await session.abortTransaction();
            return res.status(403).json({ message: "You don't have permission to change the payer" });
        }
        
        // Validate new payer is a participant
        const isParticipant = expense.participants.some(p => p.userId.toString() === newPayerId);
        if (!isParticipant) {
            await session.abortTransaction();
            return res.status(400).json({ message: "New payer must be a participant in the expense" });
        }
        
        // If payer is same, no need to update
        if (expense.paidBy.toString() === newPayerId) {
            await session.abortTransaction();
            return res.status(400).json({ message: "New payer is same as current payer" });
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
        const newPayer = await User.findById(newPayerId);
        await Activity.create([{
            activityType: 'expense_edited',
            userId,
            groupId: expense.groupId,
            expenseId: expense._id,
            description: `Changed payer to ${newPayer.username} for expense: ${expense.description}`,
            metadata: {
                amount: expense.amount,
                newPayer: newPayerId
            }
        }], { session });
        
        await session.commitTransaction();
        
        const populatedExpense = await Expense.findById(expenseId)
            .populate('paidBy', 'username name email')
            .populate('participants.userId', 'username name email');
        
        return res.status(200).json({
            message: "Payer changed successfully",
            expense: populatedExpense
        });
    } catch (error) {
        await session.abortTransaction();
        console.error("Error changing payer:", error);
        return res.status(500).json({ message: "Server error" });
    } finally {
        session.endSession();
    }
};

// Get expense details
export const getExpenseDetails = async (req, res) => {
    const { expenseId } = req.params;
    const userId = req.userId;
    
    try {
        const expense = await Expense.findById(expenseId)
            .populate('paidBy', 'username name email')
            .populate('participants.userId', 'username name email')
            .populate('createdBy', 'username name email');
        
        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }
        
        // Check if user is involved in the expense
        const isInvolved = expense.paidBy._id.toString() === userId ||
            expense.participants.some(p => p.userId._id.toString() === userId);
        
        if (!isInvolved) {
            return res.status(403).json({ message: "You don't have permission to view this expense" });
        }
        
        return res.status(200).json({ expense });
    } catch (error) {
        console.error("Error fetching expense details:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
