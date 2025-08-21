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
      type: Schema.Types.Mixed, // Can be ObjectId or String (for eth addresses)
      required: [true, 'User ID is required'],
    },
    userType: {
      type: String,
      enum: ['mongoId', 'privyId', 'ethAddress'],
      default: 'mongoId',
    },
    displayName: {
      type: String,
      default: '',
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
