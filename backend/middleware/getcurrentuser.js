import User from '../models/User.js';

export const getCurrentUser = async (req, res, next) => {
    console.log('req.currentUser:', req.currentUser);

    const userId = req.currentUser?._id;

    if (!userId) {
        return res.status(401).send('User not authenticated');
    }
    const currentUser = await User.findById(userId);
    if (!currentUser) {
        return res.status(404).send('Current user not found');
    }
    req.currentUser = currentUser;
    next();
};

