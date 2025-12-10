import mongoose from "mongoose";

const settlementSchema = mongoose.Schema({
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    paidTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null,
        index: true
    },
    note: {
        type: String,
        default: '',
        trim: true
    },
    settledAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, { timestamps: true });

// Indexes for optimization
settlementSchema.index({ paidBy: 1, settledAt: -1 });
settlementSchema.index({ paidTo: 1, settledAt: -1 });
settlementSchema.index({ groupId: 1, settledAt: -1 });

const Settlement = mongoose.model('Settlement', settlementSchema);
export default Settlement;
