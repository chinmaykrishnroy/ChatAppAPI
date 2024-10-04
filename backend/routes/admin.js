import express from 'express';
import User from '../models/User.js';
import { handleError } from '../utility/fileutils.js';

const router = express.Router();

// Admin Get All Profile
router.post('/view-all', async (req, res) => {
    const { adminPassword } = req.body;
    try {
        if (adminPassword !== '12345') return res.status(403).send('Unauthorized: Invalid admin password');
        const users = await User.find()
        res.json(users);
    } catch (err) {
        handleError(res, err);
    }
});

// Admin Delete All Users
router.delete('/delete-all', async (req, res) => {
    const { adminPassword } = req.body;

    if (adminPassword !== '12345') return res.status(403).send('Invalid admin password');
  
    try {
      await User.deleteMany({});
      res.status(200).send('All user accounts deleted successfully');
    } catch (err) {
      res.status(400).send(err.message);
    }
});

// Delete User by Username and Password by Admin
router.delete('/deleteuser', async (req, res) => {
    const { username, adminPassword } = req.body;
    try {
        if (adminPassword !== '12345') return res.status(403).send('Unauthorized: Invalid admin password');

        const user = await User.findOne({ username });

        if (!user) return res.status(404).send('User not found');

        await User.deleteOne({ _id: user._id });
        res.status(200).send('User deleted successfully');
    } catch (err) {
        res.status(400).send(err.message);
    }
});

export default router;