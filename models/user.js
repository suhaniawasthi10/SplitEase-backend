import mongoose from "mongoose";
import { genToken } from "../config/jwt.js";

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    profileImage: {
        url: {
            type: String,
            default: null
        },
        publicId: {
            type: String,
            default: null
        }
    },
    preferredCurrency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'CHF', 'SEK', 'NZD', 'MXN', 'SGD', 'HKD', 'NOK', 'KRW', 'TRY', 'RUB', 'BRL', 'ZAR']
    },
    upiId: {
        type: String,
        default: null,
        validate: {
            validator: function (v) {
                if (!v) return true; // Allow null/empty
                // UPI ID format: username@provider (provider can be bank or payment app)
                return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(v);
            },
            message: 'Invalid UPI ID format. Use format: username@provider (e.g., john@paytm, alice@hdfcbank)'
        }
    }
}, { timestamps: true })

userSchema.methods.genToken = async function () {
    return await genToken(this._id);
}

const User = mongoose.model('User', userSchema);
export default User;
