import asyncHandler from 'express-async-handler';

import ChannelUserModel from '#models/channelUser/channelUserModel.js';

const createChannelUser = asyncHandler(async (req, res) => {
  const { channelId, userId } = req.body;

  if (!channelId || !userId) {
    res.status(400);
    throw new Error('Channel ID and User ID are required');
  }

  const channelUserExists = await ChannelUserModel.findOne({
    channelId,
    userId,
  });

  if (channelUserExists) {
    res.status(400);
    throw new Error('User is already a member of this channel');
  }

  const channelUser = await ChannelUserModel.create({
    channelId,
    userId,
  });

  if (channelUser) {
    res.status(201).json(channelUser);
  } else {
    res.status(400);
    throw new Error('Invalid channel user data');
  }
});

const getChannelUsers = asyncHandler(async (req, res) => {
  const channelUsers = await ChannelUserModel.find({});

  res.json(channelUsers);
});

export { createChannelUser, getChannelUsers };
