import express from 'express';
import environment from 'dotenv';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import morgan from 'morgan';
import { createServer } from 'http'; // Import HTTP module
import connectDB from './config/db.js';
import { errorHandler } from './middlewares/errorMiddleware.js';
import routes from './routes/routes.js';

import { Server } from 'socket.io';
import socketHandler from './socket.js';

environment.config();
const port = process.env.PORT;
connectDB();

const app = express();
const server = createServer(app); // Create HTTP server instance

const io = new Server(server, {
  cors: {
    origin: '*', // Adjust this to restrict origins in production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  },
});

// Middleware setup
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
  }),
);

app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'BACKEND IS RUNNING!',
  });
});

app.use('/api', routes);
app.use(express.static('public'));

// Error handler middleware
app.use(errorHandler);

// Attach Socket.IO handler
socketHandler(io); // Pass the Socket.IO instance to your handler

// Start the server
server.listen(port, () => console.log(`Server started on port ${port}.`));
