import Group from '../models/group.js';
import Expense from '../models/expense.js';

// Get group statistics
export const getGroupStatistics = async (req, res) => {
    const { groupId } = req.params;
    const userId = req.userId;

    try {
        const group = await Group.findById(groupId).populate('members.userId', 'username name');

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user is a member
        const isMember = group.members.some(m => m.userId._id.toString() === userId);
        if (!isMember) {
            return res.status(403).json({ message: "You are not a member of this group" });
        }

        // Get all expenses for this group
        const expenses = await Expense.find({ groupId }).populate('paidBy', 'name username');

        // Calculate total spent
        const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        // Calculate expense count
        const expenseCount = expenses.length;

        // Calculate average per person
        const memberCount = group.members.length;
        const averagePerPerson = memberCount > 0 ? totalSpent / memberCount : 0;

        // Find top spender
        const spenderMap = {};
        expenses.forEach(exp => {
            const spenderId = exp.paidBy._id.toString();
            if (!spenderMap[spenderId]) {
                spenderMap[spenderId] = {
                    name: exp.paidBy.name,
                    amount: 0
                };
            }
            spenderMap[spenderId].amount += exp.amount;
        });

        const topSpender = Object.values(spenderMap).sort((a, b) => b.amount - a.amount)[0] || null;

        // Category breakdown
        const categoryMap = {};
        expenses.forEach(exp => {
            const category = exp.category || 'general';
            if (!categoryMap[category]) {
                categoryMap[category] = 0;
            }
            categoryMap[category] += exp.amount;
        });

        const categoryBreakdown = Object.entries(categoryMap).map(([category, amount]) => ({
            category,
            amount: parseFloat(amount.toFixed(2))
        })).sort((a, b) => b.amount - a.amount);

        // Spending over last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentExpenses = expenses.filter(exp => new Date(exp.date) >= thirtyDaysAgo);

        // Group by date
        const dateMap = {};
        recentExpenses.forEach(exp => {
            const dateKey = new Date(exp.date).toISOString().split('T')[0];
            if (!dateMap[dateKey]) {
                dateMap[dateKey] = 0;
            }
            dateMap[dateKey] += exp.amount;
        });

        const last30Days = Object.entries(dateMap).map(([date, amount]) => ({
            date,
            amount: parseFloat(amount.toFixed(2))
        })).sort((a, b) => new Date(a.date) - new Date(b.date));

        // Member spending breakdown
        const memberSpending = group.members.map(member => {
            const memberId = member.userId._id.toString();
            const spent = spenderMap[memberId]?.amount || 0;
            return {
                userId: member.userId._id,
                name: member.userId.name,
                amount: parseFloat(spent.toFixed(2)),
                percentage: totalSpent > 0 ? parseFloat(((spent / totalSpent) * 100).toFixed(1)) : 0
            };
        }).sort((a, b) => b.amount - a.amount);

        return res.status(200).json({
            statistics: {
                totalSpent: parseFloat(totalSpent.toFixed(2)),
                expenseCount,
                averagePerPerson: parseFloat(averagePerPerson.toFixed(2)),
                topSpender,
                categoryBreakdown,
                last30Days,
                memberSpending
            }
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};
