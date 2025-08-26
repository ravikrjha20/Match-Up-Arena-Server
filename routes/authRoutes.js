const express = require("express");
const {
  register,
  login,
  logout,
  checkAuth,
  updateProfile,
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
router.patch("/update", authenticateUser, updateProfile);
module.exports = router;
