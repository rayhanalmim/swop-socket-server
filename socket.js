import { handlePresenceTracking } from './handlers/presenceHandlers.js';
import { handleChannelEvents } from './handlers/channelHandlers.js';
import { handleDMEvents } from './handlers/dmHandlers.js';
import { handleUtilityEvents } from './handlers/utils.js';
import { handleTyping } from './handlers/typingHandlers.js';
import { handleUnreadMessages } from './handlers/unreadHandlers.js'; 
import { handleReactions } from './handlers/reactionHandlers.js';

const socketHandler = (io) => {
  const anthillChat = io.of('/anthillChat');

  anthillChat.on('connection', (socket) => {
    handlePresenceTracking(socket, anthillChat);
    handleChannelEvents(socket, anthillChat);
    handleDMEvents(socket, anthillChat);
    handleUtilityEvents(socket, anthillChat);
    handleTyping(socket, anthillChat);
    handleUnreadMessages(socket, anthillChat);
    handleReactions(socket, anthillChat); 
  });
};

export default socketHandler;
