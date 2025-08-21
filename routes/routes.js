import { Router } from 'express';

import employeeAppRoutes from './employeeAppRoutes/employeeAppRoutes.js';
import publicRoutes from './employeeAppRoutes/publicRoutes/publicRoutes.js';
import channelRoutes from './channelRoutes/channelRoutes.js';
import messegeRouter from './messegeRoute/messegeRoute.js';

const routes = Router();

routes.use('/employeeApp', employeeAppRoutes);
routes.use('/public', publicRoutes);
routes.use('/channel', channelRoutes)
routes.use('/message', messegeRouter)


export default routes;
