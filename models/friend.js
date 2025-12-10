import mongoose from "mongoose";

const friendSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    friendId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
        index: true
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

// Compound index for efficient queries
friendSchema.index({ userId: 1, friendId: 1 }, { unique: true });
friendSchema.index({ userId: 1, status: 1 });
friendSchema.index({ friendId: 1, status: 1 });

const Friend = mongoose.model('Friend', friendSchema);
export default Friend;
