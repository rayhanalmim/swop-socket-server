import Employee from '#models/authModels/employeeModel.js';
import redisClient from './../redisClient.js';

const TYPING_PREFIX = 'typing:';

export const handleTyping = (socket, anthillChat) => {
  socket.on('typing', async ({ channelId, userId, conversationId }) => {
    try {
      const user = await Employee.findById(userId);
      if (!user) throw new Error('User not found');

      const typingKey = `${TYPING_PREFIX}${channelId || conversationId}`;
      const typingData = { userId, name: user.name };

      // Store typing state in Redis with a short expiration
      await redisClient.hset(typingKey, userId, JSON.stringify(typingData)); // Changed hSet to hset
      await redisClient.expire(typingKey, 10); // Expire after 10 seconds

      anthillChat.to(channelId || conversationId).emit('typing', typingData);
    } catch (error) {
      console.error('Error handling typing event:', error.message);
      socket.emit('error', 'Error handling typing event');
    }
  });

  socket.on('stop_typing', async ({ channelId, userId, conversationId }) => {
    try {
      const typingKey = `${TYPING_PREFIX}${channelId || conversationId}`;

      // Remove the user's typing state from Redis
      await redisClient.hdel(typingKey, userId); // Changed hDel to hdel

      anthillChat
        .to(channelId || conversationId)
        .emit('stop_typing', { userId });
    } catch (error) {
      console.error('Error handling stop typing event:', error.message);
      socket.emit('error', 'Error handling stop typing event');
    }
  });
};
