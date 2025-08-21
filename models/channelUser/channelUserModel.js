import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const channelUserSchema = new Schema(
  {
    channelId: {
      type: Schema.Types.ObjectId,
      ref: 'Channel',
      required: [true, 'Channel ID is required'],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    role: {
      type: String,
      enum: ['admin', 'moderator', 'member'],
      default: 'member',
    },
  },
  {
    timestamps: true,
  },
);

channelUserSchema.index({ channelId: 1, userId: 1 }, { unique: true });

export default model('ChannelUser', channelUserSchema);
