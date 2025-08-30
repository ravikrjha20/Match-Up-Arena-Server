// controllers/leaderboardController.js
const { redisClient } = require("../utils/redisClient");
const User = require("../model/userModel");

/* ------------ Helpers ------------ */
const refreshLeaderboardCache = async () => {
  try {
    // Pull everything once, highest rating first
    const leaderboard = await User.find({}, "_id username rating avatar")
      .sort({ rating: -1 })
      .lean();

    // Cache the whole list as a JSON string
    await redisClient.set("leaderboard", JSON.stringify(leaderboard));

    // Cache each user’s rank (index + 1)
    await Promise.all(
      leaderboard.map((u, i) => redisClient.set(`userRank:${u._id}`, i + 1))
    );

    console.log("✅ Leaderboard & ranks refreshed in Redis");
  } catch (err) {
    console.error("Error refreshing leaderboard cache:", err);
  }
};

/* ------------ Route Handler ------------ */
const getLeaderboard = async (req, res) => {
  try {
    const { userId } = req.body; // optional

    // 1. Try Redis
    let leaderboard = [];
    const cached = await redisClient.get("leaderboard");

    if (cached) {
      leaderboard = JSON.parse(cached);
      console.log("⚡ Leaderboard served from Redis");
    } else {
      // 2. Cold cache → refresh
      await refreshLeaderboardCache();
      leaderboard = JSON.parse(await redisClient.get("leaderboard"));
    }

    // 3. Slice ONLY top-100
    const top100 = leaderboard.slice(0, 100);

    // 4. Grab user’s rank (if requested)
    let userRank = null;
    if (userId) {
      const cachedRank = await redisClient.get(`userRank:${userId}`);
      if (cachedRank) userRank = parseInt(cachedRank, 10);
    }

    // 5. Return response
    return res.status(200).json({
      totalUsers: leaderboard.length, // still handy for the client
      leaderboard: top100,
      userRank: userRank || null,
    });
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    return res.status(500).json({ msg: "Server error" });
  }
};

module.exports = { getLeaderboard, refreshLeaderboardCache };
