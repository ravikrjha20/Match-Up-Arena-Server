const express = require("express");
const {
  register,
  login,
  logout,
  checkAuth,
} = require("../controllers/authController");
const {
  authenticateUser,
  authorizePermissions,
} = require("../middleware/authentication");
const router = express.Router();
router.post("/register", register);
router.post("/login", login);
router.get("/logout", logout);
router.get("/check", authenticateUser, checkAuth);

module.exports = router;
