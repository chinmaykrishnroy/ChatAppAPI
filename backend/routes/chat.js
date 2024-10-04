import express from 'express';
import { auth } from '../middleware/auth.js';
import { getCurrentUser } from '../middleware/getcurrentuser.js';
import { isConnected } from '../middleware/isconnected.js';
import upload from '../middleware/upload.js';
import { detectFileType, handleError } from '../utility/fileutils.js';
import Chat from '../models/Chat.js';

const router = express.Router({ mergeParams: true });

// Start Chat
router.post('/:username/start', [auth, getCurrentUser, isConnected], async (req, res) => {
    const currentUser = req.currentUser;

    try {
        let chat = await Chat.findOne({
            participants: { $all: [currentUser._id, req.targetUser._id] },
        });

        if (chat) {
            return res.status(400).send('Chat already started. Load existing chat instead.');
        }

        chat = new Chat({
            participants: [currentUser._id, req.targetUser._id],
            messages: [],
            chatDeleteAt: null
        });

        await chat.save();
        res.status(201).json(chat);
    } catch (err) {
        res.status(500).send('Server error: ' + err.message);
    }
});

// Load Chat
router.get('/:username/load', [auth, getCurrentUser, isConnected], async (req, res) => {
    const currentUser = req.currentUser;

    try {
        const chat = await Chat.findOne({
            participants: { $all: [currentUser._id, req.targetUser._id] },
        }).populate('messages.sender', 'username');

        // If chat does not exist
        if (!chat) {
            return res.status(404).send('Chat not found. Please start a new chat.');
        }

        res.json({
            participants: chat.participants,
            messages: chat.messages,
            chatDeleteAt: chat.chatDeleteAt,
            createdAt: chat.createdAt, 
            updatedAt: chat.updatedAt 
        });
    } catch (err) {
        res.status(500).send('Server error: ' + err.message);
    }
});

// Delete Chat
router.delete('/:username/delete', [auth, getCurrentUser, isConnected], async (req, res) => {
    const currentUser = req.currentUser;

    try {
        const chat = await Chat.findOneAndDelete({
            participants: { $all: [currentUser._id, req.targetUser._id] },
        });

        if (!chat) {
            return res.status(404).send('Chat not found.');
        }

        res.status(200).send('Chat deleted successfully.');
    } catch (err) {
        res.status(500).send('Server error: ' + err.message);
    }
});

// Send Message
router.post('/:username/send', [auth, getCurrentUser, isConnected, upload.single('file')], async (req, res) => {
    const { username } = req.params;
    const { content, private: isPrivate = false, expires } = req.body;
    const currentUser = req.currentUser;

    try {
        if (!content?.trim() && !req.file) {
            return res.status(400).send('Message content or file must be provided.');
        }

        let chat = await Chat.findOne({
            participants: { $all: [currentUser._id, req.targetUser._id] },
        });

        if (!chat) {
            return res.status(404).send('Chat not found. Start a chat first.');
        }

        let fileBuffer = null;
        let fileType = null;

        if (req.file) {
            fileBuffer = req.file.buffer;

            try {
                fileType = await detectFileType(fileBuffer);
            } catch (error) {
                return handleError(res, error);
            }
        }

        const message = {
            sender: currentUser._id,
            content: content?.trim() || '',
            file: fileBuffer,
            fileType: fileType || '',
            private: isPrivate,
            seen: false,
            createdAt: Date.now(),
            expires: isPrivate
                ? expires
                    ? new Date(Date.now() + expires * 60 * 60 * 1000)
                    : new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
                : null,
        };

        chat.messages.push(message);

        await chat.save();

        const sentMessage = chat.messages[chat.messages.length - 1];
        res.status(201).json(sentMessage);
    } catch (err) {
        res.status(500).send('Server error: ' + err.message);
    }
});

// Get Most Recent Message
router.get('/:username/recentMessage', [auth, getCurrentUser, isConnected], async (req, res) => {
    const { username } = req.params;
    const currentUser = req.currentUser;

    try {
        let chat = await Chat.findOne({
            participants: { $all: [currentUser._id, req.targetUser._id] },
        });

        if (!chat || chat.messages.length === 0) {
            return res.status(404).send('No messages found in the chat.');
        }

        const recentMessage = chat.messages[chat.messages.length - 1];

        res.status(200).json(recentMessage);
    } catch (err) {
        handleError(res, err);
    }
});

// Load Chat Messages
router.get('/:username/messages', [auth, getCurrentUser, isConnected], async (req, res) => {
    const { username, messageId } = req.params;
    const currentUser = req.currentUser;

    try {
        const chat = await Chat.findOne({
            participants: { $all: [currentUser._id, req.targetUser._id] },
        }).select('messages').populate('messages.sender', 'username');

        if (!chat) {
            return res.status(404).send('Chat not found.');
        }
        res.status(200).json(chat.messages);
    } catch (err) {
        res.status(500).send('Server error: ' + err.message);
    }
});

// Delete a Message
router.delete('/:username/message/:messageId', [auth, getCurrentUser, isConnected], async (req, res) => {
    const { username, messageId } = req.params;
    const currentUser = req.currentUser;

    try {
        let chat = await Chat.findOne({
            participants: { $all: [currentUser._id, req.targetUser._id] },
        });

        if (!chat) {
            return res.status(404).send('Chat not found.');
        }

        const messageIndex = chat.messages.findIndex(msg => msg._id.toString() === messageId);
        if (messageIndex === -1) {
            return res.status(404).send('Message 1 not found.');
        }

        chat.messages.splice(messageIndex, 1);
        await chat.save();

        res.status(200).send('Message deleted successfully.');
    } catch (err) {
        handleError(res, err);
    }
});

// Update a Message
router.put('/:username/message/:messageId', [auth, getCurrentUser, isConnected], async (req, res) => {
    const { username, messageId } = req.params;
    const currentUser = req.currentUser;
    const { content, file } = req.body;

    try {
        let chat = await Chat.findOne({
            participants: { $all: [currentUser._id, req.targetUser._id] },
        });

        if (!chat) {
            return res.status(404).send('Chat not found.');
        }

        const message = chat.messages.id(messageId);
        if (!message) {
            return res.status(404).send('Message 2 not found.');
        }

        if (content) {
            message.content = content.trim();
        }

        if (file) {
            message.file = file;
            message.fileType = await detectFileType(file);
        }

        await chat.save();

        res.status(200).json(message);
    } catch (err) {
        handleError(res, err);
    }
});

// Clear All Messages
router.delete('/:username/clearMessages', [auth, getCurrentUser, isConnected], async (req, res) => {
    const { username } = req.params;
    const currentUser = req.currentUser;

    try {
        let chat = await Chat.findOne({
            participants: { $all: [currentUser._id, req.targetUser._id] },
        });

        if (!chat) {
            return res.status(404).send('Chat not found.');
        }

        chat.messages = [];
        await chat.save();

        res.status(200).send('All messages cleared.');
    } catch (err) {
        handleError(res, err);
    }
});

// Search Messages
router.get('/:username/searchMessages', [auth, getCurrentUser, isConnected], async (req, res) => {
    const { username } = req.params;
    const currentUser = req.currentUser;
    const { query } = req.query;

    if (!query || query.trim() === '') {
        return res.status(400).send('Search query cannot be empty.');
    }

    const searchTerms = query.trim().split(/\s+/);

    try {
        // Find chat based on participants
        let chat = await Chat.findOne({
            participants: { $all: [currentUser._id, req.targetUser._id] },
        });

        if (!chat) {
            return res.status(404).send('Chat not found.');
        }

        const matchingMessages = chat.messages.filter(message => {
            if (!message.content) return false;
            const messageWords = message.content.trim().split(/\s+/);
            return searchTerms.some(term => messageWords.includes(term));
        });

        const sortedMessages = matchingMessages.sort((a, b) => {
            const aMatchCount = searchTerms.filter(term => a.content.trim().split(/\s+/).includes(term)).length;
            const bMatchCount = searchTerms.filter(term => b.content.trim().split(/\s+/).includes(term)).length;
            return bMatchCount - aMatchCount; 
        });

        const resultMessages = sortedMessages.map(({ file, ...rest }) => rest);
        res.json(resultMessages);
    } catch (err) {
        handleError(res, err);
    }
});

// Load Chat Messages as HTML
router.get('/:username/messages/html', [auth, getCurrentUser, isConnected], async (req, res) => {
    const { username } = req.params;
    const currentUser = req.currentUser;

    try {
        const chat = await Chat.findOne({
            participants: { $all: [currentUser._id, req.targetUser._id] },
        }).populate('messages.sender', 'username');

        if (!chat) {
            return res.status(404).send('Chat not found.');
        }

        let html = `
            <style>
                .chat-container {
                    display: flex;
                    flex-direction: column;
                    padding: 10px;
                    max-width: 500px; /* Set a max width for chat container */
                    font-family: Arial, sans-serif; /* Set a font family */
                }
                .message {
                    margin: 5px 0;
                    padding: 10px;
                    border-radius: 10px;
                    position: relative; /* For positioning the message */
                    max-width: 70%; /* Set a max width for messages */
                }
                .message.left {
                    background-color: #f1f1f1; /* Light background for others */
                    align-self: flex-start; /* Align to left */
                }
                .message.right {
                    background-color: #007bff; /* Blue background for current user */
                    color: white;
                    align-self: flex-end; /* Align to right */
                }
                .message-header {
                    display: flex;
                    justify-content: space-between; /* Space between username and timestamp */
                }
                .username {
                    font-weight: bold;
                }
                .timestamp {
                    font-size: 0.4em; /* Smaller font for timestamp */
                    color: #000; /* Gray color for timestamp */
                }
                .file {
                    margin-top: 5px;
                    border: 1px solid #ccc; /* Border for file preview */
                    border-radius: 5px;
                    overflow: hidden; /* Hide overflow for rounded corners */
                }
                .file img {
                    max-width: 100%; /* Scale image to fit */
                    border-radius: 5px; /* Rounded corners */
                }
                .file video, .file audio {
                    width: 100%; /* Full width for video/audio */
                    border-radius: 5px; /* Rounded corners */
                }
            </style>
            <div class="chat-container">
        `;

        chat.messages.forEach(message => {
            const { content, sender, createdAt, file, fileType } = message;
            const senderUsername = sender ? sender.username : 'Unknown User';

            const messageAlignment = sender._id.equals(currentUser._id) ? 'right' : 'left';

            html += `
                <div class="message ${messageAlignment}">
                    <div class="message-header">
                        <span class="username">${senderUsername}</span>
                        <span class="timestamp">${new Date(createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div class="message-content">${content}</div>
            `;

            if (file) {
                html += `<div class="file">`;
                if (fileType.startsWith('image/')) {
                    html += `<img src="data:${fileType};base64,${file.toString('base64')}" alt="Image message"/>`;
                } else if (fileType.startsWith('video/')) {
                    html += `<video controls><source src="data:${fileType};base64,${file.toString('base64')}" type="${fileType}">Your browser does not support the video tag.</video>`;
                } else if (fileType.startsWith('audio/')) {
                    html += `<audio controls>
                                <source src="data:${fileType};base64,${file.toString('base64')}" type="${fileType}">
                                Your browser does not support the audio tag.
                            </audio>`;
                }
                html += `</div>`;
            }

            html += `</div>`;
        });

        html += '</div>';
        res.status(200).send(html);
    } catch (err) {
        res.status(500).send('Server error: ' + err.message);
    }
});

export default router;
