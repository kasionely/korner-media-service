import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const urlWithFamily = redisUrl.includes("?") ? redisUrl : `${redisUrl}?family=0`;

const redis = new Redis(urlWithFamily);

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export default redis;
