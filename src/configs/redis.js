const Redis = require('ioredis');

const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD
});

redis.on('connect', () => {
    console.info("Redis Connection Established");
});

redis.on('error', (err) => {
    console.error('Redis Error:', err);
});

module.exports = redis;