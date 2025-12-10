import User from "../models/user.js";

export const getCurrentUser = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const user = await User.findById(req.userId).select("-password");
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Format user response to match frontend expectations
        const userResponse = {
            id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        return res.status(200).json({ user: userResponse });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};

// Update user profile
export const updateUser = async (req, res) => {
    const { name, username, email } = req.body;
    const userId = req.userId;

    try {
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check username uniqueness if being updated
        if (username && username !== user.username) {
            const existingUsername = await User.findOne({ username });
            if (existingUsername) {
                return res.status(400).json({ message: "Username already exists" });
            }
            user.username = username;
        }

        // Check email uniqueness if being updated
        if (email && email !== user.email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({ message: "Email already exists" });
            }
            user.email = email;
        }

        // Update name if provided
        if (name) {
            user.name = name;
        }

        await user.save();

        // Return user without password
        const updatedUser = await User.findById(userId).select("-password");
        return res.status(200).json({
            message: "Profile updated successfully",
            user: updatedUser
        });
    } catch (error) {
        console.error("Error updating user:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
