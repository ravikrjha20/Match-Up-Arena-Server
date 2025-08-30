const cron = require("node-cron");
const {
  refreshLeaderboardCache,
} = require("../controllers/leaderboardController");

// Run every midnight
cron.schedule("0 0 * * *", () => {
  console.log("⏳ Refreshing leaderboard cache...");
  refreshLeaderboardCache();
});
