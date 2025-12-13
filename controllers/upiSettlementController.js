import Settlement from "../models/settlement.js";
import Balance from "../models/balance.js";
import User from "../models/user.js";
import Activity from "../models/activity.js";
import mongoose from "mongoose";

// Create UPI settlement (pending status)
export const createUpiSettlement = async (req, res) => {
    const { paidTo, amount, groupId, upiTransactionId } = req.body;
    const userId = req.userId;

    try {
        // Validation
        if (!paidTo || !amount) {
            return res.status(400).json({ message: "Recipient and amount are required" });
        }

        if (amount <= 0) {
            return res.status(400).json({ message: "Amount must be positive" });
        }

        if (userId === paidTo) {
            return res.status(400).json({ message: "Cannot settle with yourself" });
        }

        // Check if recipient exists and has UPI ID
        const recipient = await User.findById(paidTo);
        if (!recipient) {
            return res.status(404).json({ message: "Recipient user not found" });
        }

        if (!recipient.upiId) {
            return res.status(400).json({
                message: "Recipient has not set up UPI ID. Please ask them to add their UPI ID in profile settings."
            });
        }

        // Create pending settlement
        const settlement = await Settlement.create({
            paidBy: userId,
            paidTo,
            amount,
            groupId: groupId || null,
            paymentMethod: 'upi',
            paymentStatus: 'pending',
            upiTransactionId: upiTransactionId || null,
            note: 'UPI Payment'
        });

        const populatedSettlement = await Settlement.findById(settlement._id)
            .populate('paidBy', 'username name email')
            .populate('paidTo', 'username name email upiId');

        return res.status(201).json({
            message: "UPI settlement initiated. Please complete payment and confirm.",
            settlement: populatedSettlement,
            recipientUpiId: recipient.upiId,
            recipientName: recipient.name
        });
    } catch (error) {
        return res.status(500).json({ message: "Failed to create UPI settlement" });
    }
};

// Confirm UPI payment
export const confirmUpiPayment = async (req, res) => {
    const { id } = req.params;
    const { upiTransactionId } = req.body;
    const userId = req.userId;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const settlement = await Settlement.findById(id).session(session);

        if (!settlement) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Settlement not found" });
        }

        // Verify user is the payer
        if (settlement.paidBy.toString() !== userId) {
            await session.abortTransaction();
            return res.status(403).json({ message: "Unauthorized. Only the payer can confirm payment." });
        }

        // Check if already confirmed
        if (settlement.paymentStatus === 'completed') {
            await session.abortTransaction();
            return res.status(400).json({ message: "Payment already confirmed" });
        }

        // Update settlement status
        settlement.paymentStatus = 'completed';
        if (upiTransactionId) {
            settlement.upiTransactionId = upiTransactionId;
        }
        await settlement.save({ session });

        // Update balances using the new settleAmount method with validation
        let settlementResult;
        try {
            settlementResult = await Balance.settleAmount(
                settlement.paidBy,
                settlement.paidTo,
                settlement.amount,
                settlement.groupId,
                session
            );
        } catch (error) {
            await session.abortTransaction();
            // Revert settlement status
            settlement.paymentStatus = 'pending';
            await settlement.save();
            return res.status(400).json({
                message: error.message || "Invalid settlement amount"
            });
        }

        // Get recipient info for activity log
        const recipient = await User.findById(settlement.paidTo).session(session);

        // Log activity
        await Activity.create([{
            activityType: 'settlement_added',
            userId: settlement.paidBy,
            targetUserId: settlement.paidTo,
            groupId: settlement.groupId,
            settlementId: settlement._id,
            description: `Paid ₹${settlement.amount} to ${recipient.username} via UPI`,
            metadata: {
                amount: settlement.amount,
                paymentMethod: 'upi',
                upiTransactionId: settlement.upiTransactionId,
                previousDebt: settlementResult.previousDebt,
                remainingDebt: settlementResult.remainingDebt
            }
        }], { session });

        await session.commitTransaction();

        const populatedSettlement = await Settlement.findById(settlement._id)
            .populate('paidBy', 'username name email')
            .populate('paidTo', 'username name email');

        return res.status(200).json({
            message: settlementResult.remainingDebt > 0
                ? `Payment confirmed. You still owe ₹${settlementResult.remainingDebt.toFixed(2)}`
                : "Payment confirmed. Debt fully paid!",
            settlement: populatedSettlement,
            settlementDetails: {
                previousDebt: parseFloat(settlementResult.previousDebt.toFixed(2)),
                settledAmount: parseFloat(settlementResult.settledAmount.toFixed(2)),
                remainingDebt: parseFloat(settlementResult.remainingDebt.toFixed(2))
            }
        });
    } catch (error) {
        await session.abortTransaction();
        return res.status(500).json({ message: "Failed to confirm payment" });
    } finally {
        session.endSession();
    }
};

// Cancel UPI payment
export const cancelUpiPayment = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        const settlement = await Settlement.findById(id);

        if (!settlement) {
            return res.status(404).json({ message: "Settlement not found" });
        }

        // Verify user is the payer
        if (settlement.paidBy.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        // Can only cancel pending payments
        if (settlement.paymentStatus !== 'pending') {
            return res.status(400).json({ message: "Can only cancel pending payments" });
        }

        // Update status to failed
        settlement.paymentStatus = 'failed';
        await settlement.save();

        return res.status(200).json({
            message: "Payment cancelled",
            settlement
        });
    } catch (error) {
        return res.status(500).json({ message: "Failed to cancel payment" });
    }
};
