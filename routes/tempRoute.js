const express = require("express");
const router = express.Router();
const User = require("../model/userModel");

router.get("/temp", async (req, res) => {
  const users = await User.find({});
  res.status(200).json({ users });
});

module.exports = router;
