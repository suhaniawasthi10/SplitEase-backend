import { genToken } from "../config/jwt.js";
import User from "../models/user.js";
import bcrypt from "bcryptjs";


export const signUp = async(req, res)=>{
    const {name, username, email, password, confirmPassword} = req.body;

    if(!name || !username || !email || !password || !confirmPassword){
        return res.status(400).json({message: "All fields are required"});
    }

    const existingUsername = await User.findOne({username});
    if(existingUsername){
        return res.status(400).json({message: "Username already exists"});
    }

    const existingEmail = await User.findOne({email});
    if(existingEmail){
        return res.status(400).json({message: "Email already exists"});
    }

    if(password.length < 6){
        return res.status(400).json({message: "Password must be at least 6 characters"});
    }

    if(password !== confirmPassword){
        return res.status(400).json({message: "Passwords do not match"});
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    try {
        const user = await User.create({name, username, email, password: hashedPassword});

        const token = await user.genToken();
        res.cookie("token", token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 30,
            sameSite: "lax",
            secure: false // Set to false for local development (http://localhost)
        })

        // Return user without password
        const userResponse = {
            id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        return res.status(201).json({ user: userResponse });
    } catch (error) {
        return res.status(500).json({message: "Something went wrong"});
    }
}

export const login = async(req, res)=>{
    const{username, password} = req.body;

    if(!username || !password){
        return res.status(400).json({message: "All fields are required"});
    }
    try{
        const user = await User.findOne({username});
        if(!user){
            return res.status(404).json({message: "Username not found"});
        }

        const verifyPassword = await bcrypt.compare(password, user.password);
        if(!verifyPassword){
            return res.status(401).json({message: "Invalid credentials"});
        }

        const token = await user.genToken();
        res.cookie("token", token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 30,
            sameSite: "lax",
            secure: false // Set to false for local development (http://localhost)
        })

        // Return user without password
        const userResponse = {
            id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        return res.status(200).json({ user: userResponse });

    }
    catch(error){
        return res.status(500).json({message: "Something went wrong"});
    }
}

export const logout = async(req, res)=>{
    try {
        res.cookie("token", "", {
            httpOnly: true,
            maxAge: 0,
            sameSite: "lax",
            secure: false // Set to false for local development (http://localhost)
        })
        return res.status(200).json({message: "Logout successful"});
    } catch (error) {
        return res.status(500).json({message: "Something went wrong"});
    }
}


