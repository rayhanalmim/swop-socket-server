/* eslint-disable no-undef */
import mongoose from "mongoose";
import Channel from "#models/channel/channelModel.js";
import Message from "#models/messages/messagesModel.js";
import ChannelUser from "#models/channelUser/channelUserModel.js";
import Employee from "#models/authModels/employeeModel.js";
import User from "#models/authModels/userModal.js";
import { fetchMessages, handleError, updateCache } from "./utils.js";
import { uploadBuffer } from "#config/space.js";
import redisClient from "./../redisClient.js";

export const handleChannelEvents = (socket, anthillChat) => {
  // Create a new group chat
  socket.on("create_group", async ({ name, description, createdBy, isPrivate, members, avatarUrl }) => {
    try {
      console.log(`Creating new group chat: ${name} by ${createdBy}`);
      
      // Determine if this is an ETH-based group by checking the creator ID format
      const groupType = createdBy.startsWith('0x') ? 'ethBased' : 'regular';
      
      // Create the channel
      const channel = new Channel({
        name,
        description,
        createdBy,
        isPrivate: isPrivate || false,
        groupType,
        avatarUrl: avatarUrl || ''
      });
      
      await channel.save();
      
      // Ensure the creator exists in the user database
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
      
      // Add the creator as admin
      const creatorUser = await ensureUserExists(createdBy);
      if (creatorUser) {
        const userType = createdBy.startsWith('did:privy:') ? 'privyId' : 
                         createdBy.startsWith('0x') ? 'ethAddress' : 'mongoId';
        
        const displayName = createdBy.startsWith('did:privy:') ? 
          `User ${createdBy.substring(10, 16)}...` : 
          createdBy.startsWith('0x') ? 
          `${createdBy.substring(0, 6)}...${createdBy.substring(createdBy.length - 4)}` : 
          'Unknown User';
          
        const channelUser = new ChannelUser({
          channelId: channel._id,
          userId: creatorUser._id,
          userType,
          displayName,
          role: 'admin'
        });
        
        await channelUser.save();
      }
      
      // Add other members
      if (members && Array.isArray(members)) {
        for (const memberId of members) {
          const memberUser = await ensureUserExists(memberId);
          
          if (memberUser) {
            const userType = memberId.startsWith('did:privy:') ? 'privyId' : 
                            memberId.startsWith('0x') ? 'ethAddress' : 'mongoId';
            
            const displayName = memberId.startsWith('did:privy:') ? 
              `User ${memberId.substring(10, 16)}...` : 
              memberId.startsWith('0x') ? 
              `${memberId.substring(0, 6)}...${memberId.substring(memberId.length - 4)}` : 
              'Unknown User';
              
            const channelUser = new ChannelUser({
              channelId: channel._id,
              userId: memberUser._id,
              userType,
              displayName,
              role: 'member'
            });
            
            await channelUser.save();
          }
        }
      }
      
      // Return the created group info
      socket.emit('group_created', {
        success: true,
        groupId: channel._id,
        name: channel.name
      });
      
      console.log(`Group chat created: ${channel.name} (${channel._id})`);
    } catch (error) {
      handleError(socket, error, "Failed to create group chat");
    }
  });
  
  // Add members to an existing group
  socket.on("add_group_member", async ({ groupId, userId, memberIds }) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw new Error("Invalid Group ID");
      }

      console.log('group id user id memberids', groupId, userId, memberIds);
      
      // Check if group exists
      const channel = await Channel.findById(groupId);
      if (!channel) {
        throw new Error("Group not found");
      }
      
      // Find user based on different possible ID types
      let userDoc = null;
      console.log("Checking admin permissions for user:", userId);
      
      // If this is a Privy ID, find the user first
      if (userId.startsWith('did:privy:')) {
        userDoc = await User.findOne({ privyId: userId });
        console.log("Found user by Privy ID:", userDoc?._id);
      }
      // If this is an ETH address
      else if (userId.startsWith('0x')) {
        userDoc = await User.findOne({ ethAddress: userId });
        console.log("Found user by ETH address:", userDoc?._id);
      }
      
      // Create an array of all possible IDs to check
      const possibleUserIds = [userId];
      
      if (userDoc) {
        possibleUserIds.push(userDoc._id);
        if (userDoc.privyId) possibleUserIds.push(userDoc.privyId);
        if (userDoc.ethAddress) possibleUserIds.push(userDoc.ethAddress);
      }
      
      console.log("Checking admin permissions with IDs:", possibleUserIds);
      
      // Check if user is an admin with any of these IDs
      const channelUser = await ChannelUser.findOne({ 
        channelId: groupId, 
        userId: { $in: possibleUserIds },
        role: 'admin' 
      });
      
      console.log("Admin check result:", channelUser ? "Is admin" : "Not admin");
      
      if (!channelUser) {
        throw new Error("You do not have permission to add members to this group");
      }
      
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
      
              // Add new members
        const addedMembers = [];
        const alreadyMembers = [];
        
        if (memberIds && Array.isArray(memberIds)) {
          for (const memberId of memberIds) {
            const memberUser = await ensureUserExists(memberId);
            
            if (memberUser) {
              // Check if the user is already a member
              const existingMember = await ChannelUser.findOne({ 
                channelId: groupId, 
                $or: [
                  { userId: memberUser._id },
                  { userId: memberId }
                ]
              });
              
              if (!existingMember) {
                const userType = memberId.startsWith('did:privy:') ? 'privyId' : 
                                memberId.startsWith('0x') ? 'ethAddress' : 'mongoId';
                
                const displayName = memberId.startsWith('did:privy:') ? 
                  `User ${memberId.substring(10, 16)}...` : 
                  memberId.startsWith('0x') ? 
                  `${memberId.substring(0, 6)}...${memberId.substring(memberId.length - 4)}` : 
                  'Unknown User';
                  
                const channelUser = new ChannelUser({
                  channelId: groupId,
                  userId: memberUser._id,
                  userType,
                  displayName,
                  role: 'member'
                });
                
                await channelUser.save();
                addedMembers.push({
                  id: memberId,
                  displayName
                });
              } else {
                // Track members that were already in the group
                alreadyMembers.push({
                  id: memberId,
                  displayName: existingMember.displayName
                });
              }
            }
          }
        }
        
        // Notify all members of the group
        anthillChat.to(groupId).emit('members_added', {
          groupId,
          members: addedMembers
        });
        
        socket.emit('members_added_success', {
          success: true,
          groupId,
          members: addedMembers,
          alreadyMembers: alreadyMembers
        });
        
        console.log(`Added ${addedMembers.length} members to group ${groupId}`, 
                    alreadyMembers.length ? `(${alreadyMembers.length} were already members)` : '');
    } catch (error) {
      handleError(socket, error, "Failed to add members to group");
    }
  });
  
  // Search for users to add to group
  socket.on("search_users", async ({ query, currentGroupId }) => {
    try {
      console.log(`Searching users for: "${query}"`);
      // Search users by ETH address or ENS name
      let searchResults = [];
      
      // Search by ETH address (partial match)
      if (query.startsWith('0x')) {
        const users = await User.find({ ethAddress: { $regex: query, $options: 'i' } }).limit(10);
        console.log(`Found ${users.length} ETH address matches`);
        searchResults = users.map(user => ({
          id: user.ethAddress,
          type: 'ethAddress',
          displayName: `${user.ethAddress.substring(0, 6)}...${user.ethAddress.substring(user.ethAddress.length - 4)}`,
          actualId: user._id.toString(),
          ethAddress: user.ethAddress
        }));
      } 
      // Search by Privy ID if query looks like one
      else if (query.startsWith('did:')) {
        const users = await User.find({ privyId: { $regex: query, $options: 'i' } }).limit(10);
        console.log(`Found ${users.length} Privy ID matches`);
        searchResults = users.map(user => ({
          id: user.privyId,
          type: 'privyId',
          displayName: `User ${user.privyId.substring(10, 16)}...`,
          actualId: user._id.toString(),
          ethAddress: user.ethAddress
        }));
      }
      // For ENS-like queries (.eth or .swop.id)
      else if (query.includes('.')) {
        // First check if this user exists in our database by ENS-like name
        // For a real ENS implementation, you'd do proper ENS resolution here
        
        // For swop.id domains specifically
        if (query.endsWith('.swop.id')) {
          const username = query.replace('.swop.id', '');
          console.log(`Searching for swop.id user: ${username}`);
          
          // Try to find a user that might have this username in some form
          // This is just for demonstration - in a real app, you'd have better mapping
          const usersByPartialId = await User.find({
            $or: [
              { privyId: { $regex: username, $options: 'i' } },
              { ethAddress: { $regex: username, $options: 'i' } }
            ]
          }).limit(5);
          
          if (usersByPartialId.length > 0) {
            // Found potential users that match this username
            const bestMatch = usersByPartialId[0]; // Just take the first match for demo
            console.log(`Found user match for ${query}:`, bestMatch);
            
            searchResults.push({
              id: query,
              type: 'ens',
              displayName: query,
              actualId: bestMatch._id.toString(),
              ethAddress: bestMatch.ethAddress,
              privyId: bestMatch.privyId
            });
          } else {
            // If no exact username matches, try to find any users that might be similar
            console.log("No direct matches, trying general user search");
            
            const anyUsers = await User.find({}).limit(3);
            if (anyUsers.length > 0) {
              // If we found any users at all, suggest the first one
              const suggestedUser = anyUsers[0];
              searchResults.push({
                id: query,
                type: 'ens',
                displayName: query,
                actualId: suggestedUser._id.toString(),
                ethAddress: suggestedUser.ethAddress,
                privyId: suggestedUser.privyId,
                note: "Suggested user (demo only)"
              });
            } else {
              // No users in system at all
              searchResults.push({
                id: query,
                type: 'ens',
                displayName: query,
                note: "No users found in system"
              });
            }
          }
        } 
        // For .eth or other ENS names
        else {
          // For a real implementation, you'd do ENS resolution
          // For now just search for any matching users
          const anyUsers = await User.find({}).limit(3);
          if (anyUsers.length > 0) {
            const suggestedUser = anyUsers[0];
            searchResults.push({
              id: query,
              type: 'ens',
              displayName: query,
              actualId: suggestedUser._id.toString(),
              ethAddress: suggestedUser.ethAddress,
              note: "Suggested user for ENS (demo only)"
            });
          } else {
            searchResults.push({
              id: query,
              type: 'ens',
              displayName: query
            });
          }
        }
        
        console.log(`Found ${searchResults.length} ENS matches`);
      }
      // For any other query, assume it might be a partial username or ENS
      else {
        // Suggest as possible swop.id username
        const swopId = `${query}.swop.id`;
        console.log(`Suggesting ${swopId} as possible username`);
        
        // Search for users that might match this potential username
        const usersByPartialMatch = await User.find({
          $or: [
            { privyId: { $regex: query, $options: 'i' } },
            { ethAddress: { $regex: query, $options: 'i' } }
          ]
        }).limit(5);
        
        if (usersByPartialMatch.length > 0) {
          // Found users that match this partial query
          const suggestedUser = usersByPartialMatch[0];
          searchResults.push({
            id: swopId,
            type: 'ens',
            displayName: swopId,
            actualId: suggestedUser._id.toString(),
            ethAddress: suggestedUser.ethAddress,
            privyId: suggestedUser.privyId,
            note: "User found by partial match"
          });
        } else {
          // No matches, but still suggest the swop.id address
          const anyUsers = await User.find({}).limit(1);
          if (anyUsers.length > 0) {
            // Suggest first user as a fallback (for demo only)
            searchResults.push({
              id: swopId,
              type: 'ens',
              displayName: swopId,
              actualId: anyUsers[0]._id.toString(),
              ethAddress: anyUsers[0].ethAddress,
              note: "Demo fallback user"
            });
          } else {
            searchResults.push({
              id: swopId,
              type: 'ens',
              displayName: swopId
            });
          }
        }
      }
      
      // If a group ID is provided, filter out users who are already members
      if (currentGroupId && mongoose.Types.ObjectId.isValid(currentGroupId)) {
        const groupMembers = await ChannelUser.find({ channelId: currentGroupId });
        const memberIds = await Promise.all(groupMembers.map(async (member) => {
          if (member.userType === 'mongoId') {
            return member.userId;
          } else if (member.userType === 'ethAddress') {
            const user = await User.findOne({ ethAddress: member.userId });
            return user ? user.ethAddress : null;
          } else if (member.userType === 'privyId') {
            const user = await User.findOne({ privyId: member.userId });
            return user ? user.privyId : null;
          }
          return null;
        }));
        
        // Filter out users who are already members
        searchResults = searchResults.filter(result => !memberIds.includes(result.id));
      }
      
      socket.emit('user_search_results', searchResults);
      console.log(`Found ${searchResults.length} users matching "${query}"`);
    } catch (error) {
      handleError(socket, error, "Failed to search for users");
    }
  });
  
  // Get list of groups for a user
  socket.on("get_user_groups", async ({ userId }) => {
    try {
      // Find user in the database
      let user = null;
      if (userId.startsWith('did:privy:')) {
        user = await User.findOne({ privyId: userId });
      } else if (userId.startsWith('0x')) {
        user = await User.findOne({ ethAddress: userId });
      }
      
      if (!user) {
        throw new Error("User not found");
      }
      
      // Find all groups the user is a member of
      const userGroups = await ChannelUser.find({ userId: user._id });
      const groupIds = userGroups.map(ug => ug.channelId);
      
      // Get channel details
      const groups = await Channel.find({ _id: { $in: groupIds } });
      
      // Format group data for client
      const formattedGroups = groups.map(group => {
        const userInGroup = userGroups.find(ug => ug.channelId.toString() === group._id.toString());
        
        return {
          groupId: group._id,
          name: group.name,
          description: group.description,
          isPrivate: group.isPrivate,
          role: userInGroup ? userInGroup.role : 'member',
          avatarUrl: group.avatarUrl || '',
          createdAt: group.createdAt
        };
      });
      
      socket.emit('user_groups', formattedGroups);
      console.log(`Found ${formattedGroups.length} groups for user ${userId}`);
    } catch (error) {
      handleError(socket, error, "Failed to retrieve user groups");
    }
  });
  
  // Get members of a group
  socket.on("get_group_members", async ({ groupId }) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw new Error("Invalid Group ID");
      }
      
      // Get all members of the group
      const channelUsers = await ChannelUser.find({ channelId: groupId });
      
      // Format member data for client
      const members = await Promise.all(channelUsers.map(async (member) => {
        let userData = null;
        let status = 'offline';
        
        // Try to find user details
        if (member.userType === 'privyId') {
          userData = await User.findOne({ _id: member.userId });
        } else if (member.userType === 'ethAddress') {
          userData = await User.findOne({ _id: member.userId });
        }
        
        // Return formatted member data
        return {
          id: userData?.privyId || userData?.ethAddress || member.userId.toString(),
          displayName: member.displayName,
          role: member.role,
          status,
          avatarUrl: ''
        };
      }));
      
      socket.emit('group_members', { groupId, members });
      console.log(`Sent ${members.length} members for group ${groupId}`);
    } catch (error) {
      handleError(socket, error, "Failed to retrieve group members");
    }
  });
  socket.on("join_channel", async ({ channelId, userId }) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new Error("Invalid Channel ID");
      }

      const channel = await Channel.findById(channelId);
      if (!channel) {
        throw new Error("Channel not found");
      }

      console.log("from user join", channelId, userId);
      
      // Find user based on different possible ID types
      let userDoc = null;
      
      // If this is a Privy ID, find the user first
      if (userId.startsWith('did:privy:')) {
        userDoc = await User.findOne({ privyId: userId });
      }
      // If this is an ETH address
      else if (userId.startsWith('0x')) {
        userDoc = await User.findOne({ ethAddress: userId });
      }
      
      // Create an array of all possible IDs to check
      const possibleUserIds = [userId];
      
      if (userDoc) {
        possibleUserIds.push(userDoc._id);
        if (userDoc.privyId) possibleUserIds.push(userDoc.privyId);
        if (userDoc.ethAddress) possibleUserIds.push(userDoc.ethAddress);
      }
      
      console.log("Checking if user is member with IDs:", possibleUserIds);
      
      // Check if user is a member with any of these IDs
      const channelUser = await ChannelUser.findOne({ 
        channelId, 
        userId: { $in: possibleUserIds } 
      });
      
      if (!channelUser) {
        throw new Error("You are not a member of this channel");
      }

      // Leave all previous rooms except user's own room
      socket.rooms.forEach((room) => {
        if (room !== socket.id && room !== `user:${userId}`) {
          socket.leave(room);
        }
      });

      socket.join(channelId);

      // Reset unread count when joining channel
      const channelInfoKey = `channel:${channelId}:info`;
      await redisClient.hset(channelInfoKey, userId, "0");

      const messages = await fetchMessages({ channelId });
      socket.emit("message_history", messages);

      for (const message of messages) {
        const seenUsers = await Employee.find({ _id: { $in: message.seenBy } }, "name _id");
        socket.emit("message_seen_update", {
          messageId: message._id,
          seenUsers,
        });
      }

      console.warn("user is joining channel");

      anthillChat
        .to(channelId)
        .emit("user_joined", { userId, username: channelUser.username });
    } catch (error) {
      handleError(socket, error, "Failed to join the channel");
    }
  });

  socket.on("leave_channel", async ({ channelId, userId }) => {
    try {
      if (!channelId) throw new Error("Channel ID is required");
      socket.leave(channelId);
      anthillChat.to(channelId).emit("user_left", { userId });
    } catch (error) {
      handleError(socket, error, "Failed to leave the channel");
    }
  });

  socket.on(
    "send_message",
    async ({
      channelId,
      content,
      userId,
      messageType = "text",
      attachmentData,
    }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(channelId)) {
          throw new Error("Invalid Channel ID");
        }
        
        // Find user based on different possible ID types
        let userDoc = null;
        
        // If this is a Privy ID, find the user first
        if (userId.startsWith('did:privy:')) {
          userDoc = await User.findOne({ privyId: userId });
        }
        // If this is an ETH address
        else if (userId.startsWith('0x')) {
          userDoc = await User.findOne({ ethAddress: userId });
        }
        
        // Create an array of all possible IDs to check
        const possibleUserIds = [userId];
        
        if (userDoc) {
          possibleUserIds.push(userDoc._id);
          if (userDoc.privyId) possibleUserIds.push(userDoc.privyId);
          if (userDoc.ethAddress) possibleUserIds.push(userDoc.ethAddress);
        }
        
        console.log("Checking if user can send messages with IDs:", possibleUserIds);
        
        // Check if user is a member with any of these IDs
        const channelUser = await ChannelUser.findOne({ 
          channelId, 
          userId: { $in: possibleUserIds } 
        });
        
        if (!channelUser) {
          throw new Error("You are not a member of this channel");
        }
        
        // For group messages with Privy/ETH users, get the user doc from our custom User model
        let user;
        if (userId.startsWith('did:privy:') || userId.startsWith('0x')) {
          user = userDoc;
          if (!user) {
            throw new Error("User not found");
          }
        } else {
          user = await Employee.findById(userId);
          if (!user) {
            throw new Error("User not found");
          }
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

        // Prepare sender information
        let senderImage = '';
        let senderName = '';
        
        if (userId.startsWith('did:privy:')) {
          // For Privy users, create a display name from the ID
          senderName = `User ${userId.substring(10, 16)}...`;
        } else if (userId.startsWith('0x')) {
          // For ETH addresses, use a shortened version
          senderName = `${userId.substring(0, 6)}...${userId.substring(userId.length - 4)}`;
        } else if (user.name) {
          // For employee users with name field
          senderName = user.name;
          senderImage = user.dp || '';
        } else {
          // Fallback
          senderName = 'Unknown User';
        }
        
        const message = new Message({
          channelId,
          senderId: userId,
          senderImage,
          senderName,
          content,
          messageType,
          attachment: attachmentUrl,
          seenBy: []  
        });

        await message.save();
        await updateCache({ channelId }, message);

        // Update channel info in Redis
        const channelInfoKey = `channel:${channelId}:info`;
        const lastMessageTime = new Date().toISOString();
        
        // Update last message for all users
        await redisClient.hset(channelInfoKey, 'last_message', content);
        await redisClient.hset(channelInfoKey, 'last_message_time', lastMessageTime);

        // Emit last message update to all users
        anthillChat.emit('unread_counts', {
          channelId,
          count: 0,
          lastMessage: content,
          lastMessageTime,
          isChannel: true,
          senderId: userId // Add sender ID to identify current user's message
        });

        const channelMembers = await ChannelUser.find({ channelId });
        for (const member of channelMembers) {
          if (member.userId.toString() !== userId) {
            const memberRoom = `user:${member.userId}`;
            
            // Check if member is in the channel
            const memberSocket = Array.from(await anthillChat.in(channelId).allSockets());
            const isMemberInChannel = memberSocket.some(socketId => 
              anthillChat.sockets.get(socketId)?.rooms.has(`user:${member.userId}`)
            );

            // Only increment unread count if member is not in the channel
            if (!isMemberInChannel) {
              await redisClient.hincrby(
                channelInfoKey,
                member.userId.toString(),
                1,
              );

              const unreadCount = await redisClient.hget(
                channelInfoKey,
                member.userId.toString(),
              );

              // Emit unread count update to member's room
              anthillChat.to(memberRoom).emit('unread_counts', {
                channelId,
                count: parseInt(unreadCount, 10),
                lastMessage: content,
                lastMessageTime,
                isChannel: true,
                senderId: userId
              });
            }
          }
        }

        console.log("chenck the message", message);

        anthillChat.to(channelId).emit('receive_message', message);
        console.log(`Message sent in channel ${channelId} by ${userId}`);
      } catch (error) {
        handleError(socket, error, "Failed to send the message");
      }
    }
  );
};
