import Activity from "../models/activity.js";

// Get activities for the current user
export const getActivities = async (req, res) => {
    const userId = req.userId;
    const { groupId, activityType, limit = 50, skip = 0 } = req.query;
    
    try {
        const query = {
            $or: [
                { userId },
                { targetUserId: userId }
            ]
        };
        
        if (groupId) {
            query.groupId = groupId;
        }
        
        if (activityType) {
            query.activityType = activityType;
        }
        
        const activities = await Activity.find(query)
            .populate('userId', 'username name email')
            .populate('targetUserId', 'username name email')
            .populate('groupId', 'name')
            .populate('expenseId')
            .populate('settlementId')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));
        
        const total = await Activity.countDocuments(query);
        
        return res.status(200).json({
            count: activities.length,
            total,
            activities
        });
    } catch (error) {
        console.error("Error fetching activities:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
