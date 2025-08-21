import redisClient from '../redisClient.js';
import User from "#models/authModels/userModal.js";
import mongoose from "mongoose";

// Helper function to check if user exists and create if not
const ensureUserExists = async (userId) => {
  try {
    if (!userId) return null;
    console.log(userId);
    
    // Check if this is a Privy ID
    if (userId.startsWith('did:privy:')) {
      // Check if user exists with this privyId
      let user = await User.findOne({ privyId: userId });
      if (user) {
        console.log(`Found existing user with Privy ID: ${userId}`);
        return user;
      }
      
      // Create a new user with this Privy ID
      console.log(`Creating new user for Privy ID: ${userId}`);
      const newUser = new User({
        privyId: userId
      });
      
      return await newUser.save();
    }
    // Check if this is an ETH address
    else if (userId.startsWith('0x')) {
      // Check if user exists with this ETH address
      let user = await User.findOne({ 
        $or: [
          { ethAddress: userId }
        ] 
      });
      
      if (user) {
        console.log(`Found existing user with ETH address: ${userId}`);
        return user;
      }
      
      // Create a new user with this ETH address
      console.log(`Creating new user for ETH address: ${userId}`);
      const newUser = new User({
        ethAddress: userId
      });
      
      return await newUser.save();
    }
    // Check if this is a MongoDB ObjectID
    else if (mongoose.Types.ObjectId.isValid(userId)) {
      // Check if user exists with this ID
      let user = await User.findById(userId);
      if (user) {
        return user;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error ensuring user exists for ${userId}:`, error);
    return null;
  }
};

export const handlePresenceTracking = (socket, anthillChat) => {
  // Handle explicit request to join user's personal room
  socket.on('join_user_room', async ({ userId }) => {
    try {
      if (!userId) {
        console.error('join_user_room: Missing userId');
        return;
      }
      
      // Join the user's personal room
      const userRoom = `user:${userId}`;
      socket.join(userRoom);
      
      console.log(`User ${userId} explicitly joined personal room: ${userRoom}`);
      
      // Debug: log all rooms this socket is in
      const rooms = Array.from(socket.rooms);
      console.log(`Socket ${socket.id} is now in rooms:`, rooms);
    } catch (error) {
      console.error('Failed to join user room:', error);
    }
  });

  socket.on('user_online', async ({ userId, ethAddress }) => {
    try {
      // Ensure the user exists in the database
      let user = await ensureUserExists(userId);
      
      // If we have an ETH address and the user exists, update the ETH address if needed
      if (user && ethAddress) {
        if (!user.ethAddress) {
          user.ethAddress = ethAddress;
          await user.save();
          console.log(`Updated user ${user._id} with ETH address: ${ethAddress}`);
        }
      } else if (ethAddress && !user) {
        // Try to find or create user by ETH address if Privy ID failed
        user = await ensureUserExists(ethAddress);
      }
      
      if (user) {
        console.log(`User ${userId} exists or was created with ID: ${user._id}`);
      }
      
      // Mark user as online
      socket.userId = userId;
      await redisClient.hset(`presence:${userId}`, 'status', 'online');
      await redisClient.hset(`presence:${userId}`, 'lastSeen', Date.now());
      
      // IMPORTANT: Make sure the socket joins the user's personal room
      const userRoom = `user:${userId}`;
      socket.join(userRoom);
      console.log(`User ${userId} joined personal room: ${userRoom}`);

      console.log(`User ${userId} is now online`);
      anthillChat.emit('user_presence_updated', { userId, status: 'online' });

      // Emit the presence status of all users
      const allUsers = await redisClient.keys('presence:*');
      const presenceStatuses = await Promise.all(allUsers.map(async (key) => {
        const userId = key.split(':')[1];
        const status = await redisClient.hget(key, 'status');
        const lastSeen = await redisClient.hget(key, 'lastSeen');
        return { userId, status, lastSeen };
      }));
      anthillChat.emit('all_users_presence', presenceStatuses);
    } catch (error) {
      console.error('Failed to mark user as online:', error);
    }
  });

  socket.on('disconnect', async () => {
    try {
      const userId = socket.userId; 
      console.log(userId);
      // Mark user as offline
      await redisClient.hset(`presence:${userId}`, 'status', 'offline');
      await redisClient.hset(`presence:${userId}`, 'lastSeen', Date.now());

      console.log(`User ${userId} disconnected`);
      anthillChat.emit('user_presence_updated', {
        userId,
        status: 'offline',
        lastSeen: Date.now(),
      });

      // Emit the presence status of all users
      const allUsers = await redisClient.keys('presence:*');
      const presenceStatuses = await Promise.all(allUsers.map(async (key) => {
        const userId = key.split(':')[1];
        const status = await redisClient.hget(key, 'status');
        const lastSeen = await redisClient.hget(key, 'lastSeen');
        return { userId, status, lastSeen };
      }));
      anthillChat.emit('all_users_presence', presenceStatuses);
    } catch (error) {
      console.error('Failed to mark user as offline:', error);
    }
  });

  socket.on('check_user_presence', async ({ userId }) => {
    try {
      const status = await redisClient.hget(`presence:${userId}`, 'status');
      const lastSeen = await redisClient.hget(`presence:${userId}`, 'lastSeen');
      socket.emit('user_presence_status', { userId, status, lastSeen });
    } catch (error) {
      console.error('Failed to fetch user presence status:', error);
    }
  });
};
