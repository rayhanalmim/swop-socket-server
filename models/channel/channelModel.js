import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const channelSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a channel name'],
    },
    description: {
      type: String,
      default: '',
    },
    isPrivate: {
      type: Boolean,
      default: false, // Public by default
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export default model('Channel', channelSchema);
