// utils/redisHelper.js
const { redisClient } = require("./redisClient"); // Your Redis client setup

const redisKey = (type, id) => `${type}:${id}`;

const getCache = async (key) => {
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};

const setCache = async (key, value, ttl = 3600) => {
  await redisClient.setEx(key, ttl, JSON.stringify(value));
};

/**
 * Deletes one or more keys from the cache.
 * @param {string|string[]} keys - A single key or an array of keys to delete.
 */
const delCache = async (keys) => {
  const keysToDelete = Array.isArray(keys) ? keys : [keys];
  if (keysToDelete.length > 0) {
    await redisClient.del(keysToDelete);
  }
};

module.exports = { getCache, setCache, delCache, redisKey };
