import redisClient from './../redisClient.js';

export const handleUnreadMessages = (socket, anthillChat) => {
  socket.on('message_read', async ({ userId, conversationId, channelId }) => {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const userRoom = `user:${userId}`;
      const infoKey = channelId 
        ? `channel:${channelId}:info` 
        : `conversation:${conversationId}:info`;

      // Reset unread count
      await redisClient.hset(infoKey, userId, '0');

      // Get last message info
      const lastMessage = await redisClient.hget(infoKey, 'last_message') || 'No messages yet';
      const lastMessageTime = await redisClient.hget(infoKey, 'last_message_time') || new Date().toISOString();

      // Emit updated count
      anthillChat.to(userRoom).emit('unread_counts', {
        channelId,
        conversationId,
        count: 0,
        lastMessage,
        lastMessageTime,
        isChannel: !!channelId
      });
    } catch (error) {
      console.error('Failed to reset unread message count:', error);
      socket.emit('error', 'Failed to reset unread message count');
    }
  });

  socket.on('fetch_unread_counts', async ({ userId }) => {
    try {
      if (!userId) throw new Error('User ID is required');

      const userRoom = `user:${userId}`;
      socket.join(userRoom);

      // Fetch all channel and DM unread counts in parallel
      const [channelKeys, conversationKeys] = await Promise.all([
        redisClient.keys('channel:*:info'),
        redisClient.keys('conversation:*:info')
      ]);

      // Process channels
      const channelUnreadCounts = await Promise.all(channelKeys.map(async (key) => {
        const channelId = key.split(':')[1];
        const [unreadCount, lastMessage, lastMessageTime] = await Promise.all([
          redisClient.hget(key, userId) || '0',
          redisClient.hget(key, 'last_message') || 'No messages yet',
          redisClient.hget(key, 'last_message_time') || new Date().toISOString()
        ]);

        return {
          channelId,
          count: parseInt(unreadCount, 10),
          lastMessage,
          lastMessageTime,
          isChannel: true
        };
      }));

      // Process DMs
      const dmUnreadCounts = await Promise.all(conversationKeys.map(async (key) => {
        const conversationId = key.split(':')[1];
        const [unreadCount, lastMessage, lastMessageTime] = await Promise.all([
          redisClient.hget(key, userId) || '0',
          redisClient.hget(key, 'last_message') || 'No messages yet',
          redisClient.hget(key, 'last_message_time') || new Date().toISOString()
        ]);

        return {
          conversationId,
          count: parseInt(unreadCount, 10),
          lastMessage,
          lastMessageTime,
          isChannel: false
        };
      }));

      // Emit combined unread counts
      anthillChat.to(userRoom).emit('unread_counts', {
        channels: channelUnreadCounts,
        directMessages: dmUnreadCounts
      });
    } catch (error) {
      console.error('Failed to fetch unread message counts:', error);
      socket.emit('error', 'Failed to fetch unread message counts');
    }
  });
};
