import { Router } from 'express';
import channelUserRoutes from '#routes/channelUserRoutes/channelUserRoutes.js';
import channelRoutes from '#routes/channelRoutes/channelRoutes.js';


const publicRoutes = Router();


publicRoutes.use('/channelUser', channelUserRoutes);
publicRoutes.use('/channel', channelRoutes);

export default publicRoutes;
