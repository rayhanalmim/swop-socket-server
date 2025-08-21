import {
  createChannelUser,
  getChannelUsers,
} from '#controllers/channelUserController/channelUserController.js';
import { Router } from 'express';

const channelUserRoutes = Router();

channelUserRoutes.route('/getAllChannelsUser').get(getChannelUsers);
channelUserRoutes.route('/create-channelUser').post(createChannelUser);

export default channelUserRoutes;
