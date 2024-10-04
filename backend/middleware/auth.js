import jwt from 'jsonwebtoken';
import config from '../config/config.js';

export const auth = (req, res, next) => {
    const token = req.cookies['session_id'];
    if (!token) return res.status(401).send('Access Denied');

    try {
        const verified = jwt.verify(token, config.jwtSecret);
        req.currentUser = verified;
        console.log('Token verified. User:', req.currentUser);
        next();
    } catch (err) {
        console.error('Token verification error:', err);
        res.status(400).send('Invalid Token');
    }
};
