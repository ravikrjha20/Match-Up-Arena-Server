const express = require("express");
const router = express.Router();
const { getLeaderboard } = require("../controllers/CompetitiveController");

router.post("/getleaderboard", getLeaderboard);

module.exports = router;
