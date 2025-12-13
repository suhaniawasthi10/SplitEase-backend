import mongoose from "mongoose";

const expenseSchema = mongoose.Schema({
    description: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    splitType: {
        type: String,
        enum: ['equal', 'exact', 'percentage'],
        default: 'equal',
        required: true
    },
    participants: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        share: {
            type: Number,
            required: true,
            min: 0
        },
        // For percentage split, this stores the percentage (0-100)
        // For exact split, this stores the exact amount
        // For equal split, this stores the calculated equal share
    }],
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null,
        index: true
    },
    category: {
        type: String,
        default: 'general',
        trim: true
    },
    date: {
        type: Date,
        default: Date.now,
        index: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    notes: {
        type: String,
        default: '',
        trim: true
    },
    currency: {
        type: String,
        default: 'USD'
    }
}, { timestamps: true });

// Indexes for optimization
expenseSchema.index({ groupId: 1, date: -1 });
expenseSchema.index({ 'participants.userId': 1, date: -1 });
expenseSchema.index({ paidBy: 1, date: -1 });

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
