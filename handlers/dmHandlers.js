/* eslint-disable no-undef */

import Message from "#models/messages/messagesModel.js";
import {
  createConversationId,
  fetchMessages,
  handleError,
  updateCache,
} from "./utils.js";
import { uploadBuffer } from "#config/space.js";
import User from "#models/authModels/userModal.js";
import redisClient from "./../redisClient.js";

export const handleDMEvents = (socket, anthillChat) => {
  let currentConversationId = null;

  socket.on("join_dm", async ({ conversationId, userId }) => {
    try {
      console.log("Joining DM conversation", conversationId, userId);
      if (!conversationId || !userId) {
        throw new Error("Conversation ID and User ID are required");
      }

      // Ensure the user exists in the database
      const ensureUserExists = async (id) => {
        if (!id) return null;
        
        try {
          // Check if this is a Privy ID
          if (id.startsWith('did:privy:')) {
            // Check if user exists with this privyId
            let user = await User.findOne({ privyId: id });
            if (user) {
              return user;
            }
            
            // Create a new user with this Privy ID
            console.log(`Creating new user for Privy ID: ${id}`);
            const newUser = new User({ privyId: id });
            return await newUser.save();
          }
          // Check if this is an ETH address
          else if (id.startsWith('0x')) {
            // Check if user exists with this ETH address
            let user = await User.findOne({ 
              $or: [
                { ethAddress: id }
              ] 
            });
            
            if (user) {
              return user;
            }
            
            // Create a new user with this ETH address
            console.log(`Creating new user for ETH address: ${id}`);
            const newUser = new User({ ethAddress: id });
            return await newUser.save();
          }
          
          return null;
        } catch (error) {
          console.error(`Error ensuring user exists for ${id}:`, error);
          return null;
        }
      };
      
      // Check if the conversation ID contains ETH addresses
      // This helps ensure we're using consistent conversation IDs
      const hasEthAddress = conversationId.includes('0x');
      if (hasEthAddress) {
        console.log('Conversation ID contains ETH addresses, using as is');
      }
      
      // Make sure the user exists
      await ensureUserExists(userId);
      
      // If the user is already in a conversation, leave the previous one
      if (currentConversationId && currentConversationId !== conversationId) {
        socket.leave(currentConversationId);
      }

      // Leave all other rooms except the user's own room
      socket.rooms.forEach((room) => {
        if (room !== socket.id && room !== `user:${userId}`) {
          socket.leave(room);
        }
      });

      // IMPORTANT: Make sure the socket joins both the conversation room and the user room
      socket.join(conversationId);
      socket.join(`user:${userId}`);
      
      // Store the current conversation ID
      currentConversationId = conversationId;
      
      console.log(`User ${userId} joined rooms: ${conversationId} and user:${userId}`);

      // Reset unread count when joining conversation
      const conversationInfoKey = `conversation:${conversationId}:info`;
      await redisClient.hset(conversationInfoKey, userId, "0");

      // Fetch messages for the conversation
      // This will now work with the original Privy IDs
      const messages = await fetchMessages({ conversationId });
      socket.emit("private_message_history", messages);
      
      // Debug: log all rooms this socket is in
      const rooms = Array.from(socket.rooms);
      console.log(`Socket ${socket.id} is now in rooms:`, rooms);
      
      console.log(`User ${userId} joined conversation ${conversationId}`);
    } catch (error) {
      handleError(socket, error, "Failed to join the private conversation");
    }
  });

  socket.on(
    "send_dm",
    async ({ senderId, recipientId, content, attachmentData, messageType, conversationId: clientConversationId }) => {
      try {
        console.log(`Processing message from ${senderId} to ${recipientId}`);
        
        // Ensure both users exist in the database
        const ensureUserExists = async (id) => {
          if (!id) return null;
          
          try {
            // Check if this is a Privy ID
            if (id.startsWith('did:privy:')) {
              // Check if user exists with this privyId
              let user = await User.findOne({ privyId: id });
              if (user) {
                return user;
              }
              
              // Create a new user with this Privy ID
              console.log(`Creating new user for Privy ID: ${id}`);
              const newUser = new User({ privyId: id });
              return await newUser.save();
            }
            // Check if this is an ETH address
            else if (id.startsWith('0x')) {
              // Check if user exists with this ETH address
              let user = await User.findOne({ 
                $or: [
                  { ethAddress: id }
                ] 
              });
              
              if (user) {
                return user;
              }
              
              // Create a new user with this ETH address
              console.log(`Creating new user for ETH address: ${id}`);
              const newUser = new User({ ethAddress: id });
              return await newUser.save();
            }
            
            return null;
          } catch (error) {
            console.error(`Error ensuring user exists for ${id}:`, error);
            return null;
          }
        };
        
        // Make sure both users exist
        const senderUser = await ensureUserExists(senderId);
        const recipientUser = await ensureUserExists(recipientId);
        
        if (!senderUser) {
          console.error(`Could not create or find sender with ID: ${senderId}`);
        }
        
        if (!recipientUser) {
          console.error(`Could not create or find recipient with ID: ${recipientId}`);
        }
        
        // IMPORTANT: Use the client-provided conversation ID if available
        // This ensures consistency between client and server
        let conversationId;
        if (clientConversationId) {
          console.log(`Using client-provided conversation ID: ${clientConversationId}`);
          conversationId = clientConversationId;
        } else {
          // Fall back to creating a conversation ID from the user IDs
          conversationId = createConversationId(senderId, recipientId);
          console.log(`Created conversation ID: ${conversationId}`);
        }
        
        let attachmentUrl = null;
        if (attachmentData?.attachment) {
          const buffer = Buffer.from(attachmentData.attachment.data, "base64");
          const result = await uploadBuffer(
            attachmentData.filePath,
            buffer,
            attachmentData.attachment.mimetype
          );
          attachmentUrl = result;
        }

        // Create message with original IDs
        const message = new Message({
          senderId: senderId,  // Use the original Privy ID
          senderName: senderId.startsWith('did:privy:') ? 
                      `User ${senderId.substring(10, 16)}...` : 
                      senderId.startsWith('0x') ? 
                      `${senderId.substring(0, 6)}...${senderId.substring(senderId.length - 4)}` : 
                      'Unknown User',
          recipientId: recipientId,  // Use the original Privy ID
          content,
          messageType,
          conversationId: conversationId,
          attachment: attachmentUrl,
        });

        await message.save();
        await updateCache({ conversationId }, message);

        // Store last message and unread count in Redis
        const conversationInfoKey = `conversation:${conversationId}:info`;
        const lastMessageTime = new Date().toISOString();

        // Update last message info
        await redisClient.hset(conversationInfoKey, 'last_message', content);
        await redisClient.hset(
          conversationInfoKey,
          "last_message_time",
          lastMessageTime
        );

        // Emit last message update to all users
        anthillChat.emit('unread_counts', {
          conversationId,
          count: 0,
          lastMessage: content,
          lastMessageTime,
          isChannel: false,
          senderId
        });

        // Check if recipient is in the conversation
        const recipientSocket = Array.from(await anthillChat.in(conversationId).allSockets());
        const isRecipientInConversation = recipientSocket.some(socketId => 
          anthillChat.sockets.get(socketId)?.rooms.has(`user:${recipientId}`)
        );

        // Only increment unread count if recipient is not in the conversation
        if (!isRecipientInConversation) {
          await redisClient.hincrby(conversationInfoKey, recipientId, 1);
          const unreadCount = await redisClient.hget(
            conversationInfoKey,
            recipientId,
          );

          const recipientRoom = `user:${recipientId}`;
          anthillChat.to(recipientRoom).emit('unread_counts', {
            conversationId,
            count: parseInt(unreadCount, 10) || 0,
            lastMessage: content,
            lastMessageTime,
            isChannel: false,
            senderId
          });
        }

        console.log('messege : ', message);
        
        // Emit the message to multiple places to ensure delivery:
        // 1. To the conversation room
        anthillChat.to(conversationId).emit('recived_dm', message);
        
        // 2. Directly to the recipient's personal room
        const recipientRoom = `user:${recipientId}`;
        anthillChat.to(recipientRoom).emit('recived_dm', message);
        
        // 3. Directly to the sender's personal room (for echo)
        const senderRoom = `user:${senderId}`;
        anthillChat.to(senderRoom).emit('recived_dm', message);
        
        // 4. Broadcast to everyone - this is a fallback to ensure delivery
        // We'll filter on the client side
        anthillChat.emit('recived_dm_broadcast', {
          message,
          conversationId,
          senderId,
          recipientId
        });
        
        console.log(`Message sent from ${senderId} to ${recipientId} in conversation ${conversationId}`);
        console.log(`Also emitted to recipient room ${recipientRoom} and sender room ${senderRoom}`);
        
      } catch (error) {
        handleError(socket, error, "Failed to send the direct message");
      }
    }
  );

  socket.on("leave_dm", ({ conversationId }) => {
    try {
      if (!conversationId) {
        throw new Error("Conversation ID is required");
      }

      socket.leave(conversationId);
      currentConversationId = null;

      console.log(`User has left the conversation: ${conversationId}`);
    } catch (error) {
      handleError(socket, error, "Failed to leave the private conversation");
    }
  });
};
