import mongoose from "mongoose";
import Message from "#models/messages/messagesModel.js";
import redisClient from "../redisClient.js";
import User from "#models/authModels/userModal.js";

export const createConversationId = (user1, user2) =>
  [user1, user2].sort().join("_");

export const fetchMessages = async (filter, limit = 50) => {
  const cacheKey = JSON.stringify(filter);
  const cachedMessages = await redisClient.get(cacheKey);

  if (cachedMessages) {
    console.log("Fetching messages from Redis cache");
    let messages = JSON.parse(cachedMessages);

    // Ensure reactions and seenBy users are included
    for (let msg of messages) {
      msg.reactions = await getReactions(msg._id);

      // Fetch seenBy users from Redis
      const seenByUsers = await redisClient.smembers(
        `message:${msg._id}:seenBy`
      );
      if (seenByUsers.length) {
        msg.seenBy = await User.find(
          { _id: { $in: seenByUsers } },
          "name _id dp"
        );
      }
    }

    return messages;
  }

  // Fetch from database if not cached
  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit);

  for (let msg of messages) {
    msg.reactions = await getReactions(msg._id);
    msg.seenBy = await User.find(
      { _id: { $in: msg.seenBy } },
      "name _id dp"
    );
  }

  // Store messages in Redis
  await redisClient.set(cacheKey, JSON.stringify(messages), "EX", 60 * 5);

  return messages;
};

export const updateCache = async (filter, newMessage, limit = 50) => {
  console.log("updating cache");
  const cacheKey = JSON.stringify(filter);
  const cachedMessages = await redisClient.get(cacheKey);

  let messages = cachedMessages ? JSON.parse(cachedMessages) : [];

  // Fetch reactions for the new message and add them
  const reactions = await getReactions(newMessage._id); // Fetch reactions for the new message
  newMessage.reactions = reactions; // Attach reactions to the new message

  messages.unshift(newMessage); // Add the new message to the beginning

  if (messages.length > limit) {
    messages.pop(); // Remove the oldest message if cache size exceeds limit
  }

  // Update the cache with the new message and its reactions
  await redisClient.set(cacheKey, JSON.stringify(messages), "EX", 60 * 5); // Cache for 5 minutes
};

const getReactions = async (messageId) => {
  // Fetch reactions for the message (assuming they're stored in a separate collection)
  const message = await Message.findById(messageId);
  return message ? message.reactions : [];
};

export const handleError = (socket, error, clientMessage) => {
  console.error(clientMessage, error);
  socket.emit("error", clientMessage);
};

export const handleUtilityEvents = (socket, anthillChat) => {
  socket.on(
    "edit_message",
    async ({ messageId, newContent, userId, channelId, conversationId }) => {
      try {
        // Validate messageId
        if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
          throw new Error("Invalid Message ID");
        }

        // Find message using both channelId and conversationId
        const query = {
          _id: messageId,
          ...(channelId ? { channelId } : {}),
          ...(conversationId ? { conversationId } : {}),
        };

        const message = await Message.findOne(query);

        if (!message) {
          throw new Error("Message not found");
        }

        if (message.senderId.toString() !== userId) {
          throw new Error("Unauthorized: You can only edit your own messages");
        }

        const oneHour = 60 * 60 * 1000;
        if (new Date() - new Date(message.createdAt) > oneHour) {
          throw new Error("You cannot edit messages older than 1 hour");
        }

        message.content = newContent;
        message.edited = true;
        await message.save();

        // Update Redis cache
        const filter = channelId ? { channelId } : { conversationId };
        const cacheKey = JSON.stringify(filter);
        const cachedMessages = await redisClient.get(cacheKey);

        if (cachedMessages) {
          const messages = JSON.parse(cachedMessages);
          const updatedMessages = messages.map((msg) =>
            msg._id === messageId
              ? { ...msg, content: newContent, edited: true }
              : msg
          );
          await redisClient.set(
            cacheKey,
            JSON.stringify(updatedMessages),
            "EX",
            60 * 5
          );
        }

        // Emit to the appropriate room
        const room = channelId || conversationId;
        anthillChat.to(room).emit("message_edited", {
          messageId,
          newContent,
          edited: true,
        });
      } catch (error) {
        handleError(socket, error, "Failed to edit the message");
      }
    }
  );

  socket.on("mark_message_seen", async ({ channelId, userId, messageId }) => {
    try {
      // Validate Channel ID and Message ID
      if (
        !mongoose.Types.ObjectId.isValid(channelId) ||
        !mongoose.Types.ObjectId.isValid(messageId)
      ) {
        throw new Error("Invalid Channel ID or Message ID");
      }

      console.log("mark_message_seen", channelId, userId, messageId);

      // Fetch the current message and its associated messages in the channel
      const message = await Message.findById(messageId).populate("channelId");
      if (!message) {
        throw new Error("Message not found");
      }

      // Fetch user details using findOne since we expect a single document
      const userinfo = await User.findOne({ _id: userId }).select(
        "name _id dp"
      );
      if (!userinfo) {
        throw new Error("User not found");
      }

      // Check if the user has already marked this specific message as seen
      const alreadySeen = message.seenBy.some((user) => user._id === userId); // `_id` is now stored as a string
      if (!alreadySeen) {
        // Add user to the `seenBy` array for the current message
        message.seenBy.push({
          _id: userinfo._id.toString(), // Ensure `_id` is stored as string
          name: userinfo.name,
          dp: userinfo.dp,
        });

        // Remove the user from the seenBy array of all previous messages in the same channel
        const allMessagesInChannel = await Message.find({
          channelId: channelId,
        }).sort({ createdAt: 1 }); // Ensure messages are sorted by creation date
        const currentMessageIndex = allMessagesInChannel.findIndex(
          (msg) => msg._id.toString() === messageId
        );

        // Remove the user from all previous messages' seenBy arrays
        for (let i = 0; i < currentMessageIndex; i++) {
          const prevMessage = allMessagesInChannel[i];
          const userIndex = prevMessage.seenBy.findIndex(
            (user) => user._id === userId
          );
          if (userIndex !== -1) {
            prevMessage.seenBy.splice(userIndex, 1);
            await prevMessage.save(); // Save updated previous message
          }
        }

        // Save the current message with updated seenBy list
        await message.save();

        // Update Redis with the user that marked the message as seen
        const messageSeenKey = `message:${messageId}:seenBy`;
        await redisClient.sadd(messageSeenKey, userId);

        console.log("message seen updated", message.seenBy);

        // Emit the updated seen status to all members in the channel
        anthillChat.to(channelId).emit("message_seen_update", {
          messageId,
          seenUsers: message.seenBy, // `seenBy` now contains full user info
        });

        console.log("Seen message broadcasted");
      }
    } catch (error) {
      handleError(socket, error, "Failed to mark message as seen");
    }
  });
};
