import Redis from 'ioredis';

const redisClient = new Redis();

redisClient.on('connect', () => {
  console.log('Redis client connected');
});

redisClient.on('error', (err) => {
  console.error('Redis connection failed:', err);
});

export default redisClient;
