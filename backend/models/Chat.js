import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String },
  file: { type: Buffer },
  fileType: { type: String },
  seen: { type: Boolean, default: false },
  private: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  expires: { type: Date }
});

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  messages: [messageSchema],
  chatDeleteAt: { type: Date }
}, { timestamps: true });

export default mongoose.model('Chat', chatSchema);