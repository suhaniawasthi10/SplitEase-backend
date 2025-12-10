import mongoose from "mongoose";
import { genToken } from "../config/jwt.js";

const userSchema = mongoose.Schema({
    name:{
        type: String,
        required: true
    },
    username:{
        type: String,
        required: true,
        unique: true
    },
    email:{
        type: String,
        required: true,
        unique: true
    },
    password:{
        type: String,
        required: true
    }
}, {timestamps: true})

userSchema.methods.genToken = async function() {
    return await genToken(this._id);
}

const User = mongoose.model('User', userSchema);
export default User;
