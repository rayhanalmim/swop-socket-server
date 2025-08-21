import Message from "#models/messages/messagesModel.js";
import e from "express";
import redisClient from "../redisClient.js";

export const handleReactions = (socket, anthillChat) => {
  // Add a reaction to a message
  socket.on("add_reaction", async ({ messageId, emoji, userId }) => {
    try {
      const message = await Message.findById(messageId);

      if (!message) {
        socket.emit("error", { message: "Message not found" });
        return;
      }

      // Check if the reaction already exists
      const existingReaction = message.reactions.find(
        (reaction) =>
          reaction.userId.toString() === userId && reaction.reaction === emoji
      );

      console.log("Existing reaction:", existingReaction);

      if (existingReaction) {
        console.log("Reaction already exists, skipping.");
        return; // If the reaction already exists, skip adding
      }

      // Add the new reaction to the message
      message.reactions.push({ userId, reaction: emoji });

      // Save the updated message with the new reaction
      await message.save();

      // Update the reactions in Redis
      const messageKey = `message:${messageId}`;
      await redisClient.hset(
        messageKey,
        "reactions",
        JSON.stringify(message.reactions)
      );

      // Emit the updated reactions to the roomf

      console.log(message);
      if (message.channelId) {
        console.log(message.channelId);
      console.log(message.channelId.toString());
      }else{ 
        console.log(message.conversationId);
      }
      

      if (message.channelId) {
        anthillChat.to(message.channelId.toString()).emit("reaction_updated", {
          messageId,
          reactions: message.reactions,
        });
      } else {
        anthillChat
          .to(message.conversationId.toString())
          .emit("reaction_updated", {
            messageId,
            reactions: message.reactions,
          });
      }

      console.log(`Reaction added for message ${messageId} by ${userId}`);
    } catch (error) {
      console.error("Error adding reaction:", error);
      socket.emit("error", { message: "Unable to add reaction" });
    }
  });

  // Remove a reaction from a message
  socket.on("remove_reaction", async ({ messageId, emoji, userId }) => {
    try {
      const message = await Message.findById(messageId);

      if (!message) {
        socket.emit("error", { message: "Message not found" });
        return;
      }

      // Filter out the reaction from the reactions array
      message.reactions = message.reactions.filter(
        (reaction) =>
          !(
            reaction.userId.toString() === userId && reaction.reaction === emoji
          )
      );

      await message.save();

      // Update Redis after removing the reaction
      const messageKey = `message:${messageId}`;
      if (message.reactions.length > 0) {
        await redisClient.hset(
          messageKey,
          "reactions",
          JSON.stringify(message.reactions)
        );
      } else {
        // If no reactions are left, remove the key from Redis
        await redisClient.hdel(messageKey, "reactions");
      }

      // Emit the updated reactions to the room
      anthillChat
        .to(message.channelId.toString() || message.conversationId.toString())
        .emit("reaction_updated", {
          messageId,
          reactions: message.reactions,
        });

      console.log(`Reaction removed for message ${messageId} by ${userId}`);
    } catch (error) {
      console.error("Error removing reaction:", error);
      socket.emit("error", { message: "Unable to remove reaction" });
    }
  });
};
