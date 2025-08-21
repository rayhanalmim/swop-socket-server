import { updateDirectMessage, updateGroupMessage } from '#controllers/messageController/messageController.js';
import { Router } from 'express';

const messegeRouter = Router();

messegeRouter.route('/group/:channelId/message/:messageId').put(updateGroupMessage);
messegeRouter.route('/dm/:conversationId/message/:messageId').put(updateDirectMessage);

export default messegeRouter;