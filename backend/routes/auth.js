import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import { auth } from '../middleware/auth.js';
import { getCurrentUser } from '../middleware/getcurrentuser.js';
import User from '../models/User.js';
import config from '../config/config.js';

const router = express.Router();

// Register User
router.post('/register', [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('age').optional().isInt({ min: 0 }).withMessage('Age must be a positive number'),
    body('sex').optional().isIn(['Male', 'Female', 'Other']).withMessage('Sex must be Male, Female, or Other'),
    body('bio').optional().isLength({ max: 500 }).withMessage('Bio must not exceed 500 characters'),
], async (req, res) => {
    const { username, email, password, firstName, lastName, age, sex, bio } = req.body;

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).send('Username already exists');

        const existingEmail = await User.findOne({ email });
        if (existingEmail) return res.status(400).send('Email already exists');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            firstName,
            lastName,
            age,
            sex,
            bio,
        });

        await newUser.save();
        res.status(201).send('User registered successfully');
    } catch (err) {
        res.status(400).send(err.message);
    }
});

// Login User
router.post('/login', async (req, res) => {
    const { identifier, password } = req.body;

    try {
        const user = await User.findOne({
            $or: [
                { email: identifier },
                { username: identifier }
            ]
        });

        if (!user) return res.status(400).send('User not found');

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).send('Invalid password');

        const token = jwt.sign({ _id: user._id }, config.jwtSecret, { expiresIn: '30d' });
        res.cookie('session_id', token, {
            httpOnly: true,
            secure: config.secure === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        res.send('Logged in successfully');
        // res.header('Authorization', token).send({ token });
    } catch (err) {
        res.status(400).send(err.message);
    }
});

// Logout User (Just needs client-side to remove token)
router.post('/logout', auth, (req, res) => {
    res.clearCookie('session_id');
    res.send('Logged out successfully');
});

// Delete Current User by Password
router.delete('/deleteUser', [auth, getCurrentUser], async (req, res) => {
    const { password } = req.body;

    try {
        const user = req.currentUser;

        if (!user) return res.status(404).send('User not found');

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).send('Invalid password');

        await User.deleteOne({ _id: user._id });
        res.status(200).send('User deleted successfully');
    } catch (err) {
        res.status(400).send(err.message);
    }
});

export default router;
