const express = require("express");
const router = express.Router();

const {
  authenticateUser,
  authorizePermissions,
} = require("../middleware/authentication");
const {
  playWithRandomOnlineUser,
  playOneVOne,
} = require("../controllers/play1v1");
const {
  inviteOneVone,
  acceptInvite,
  cancelInvite,
  rejectInvite,
} = require("../controllers/playWithFriend");

router.get("/playonevone", authenticateUser, playWithRandomOnlineUser);
router.post("/quick/onevone/:opponentId", authenticateUser, playOneVOne);
router.post("/playonevone/:friendId", authenticateUser, inviteOneVone);
router.post("/cancelRequest", authenticateUser, cancelInvite);
router.post("/acceptInvite/:playerId", authenticateUser, acceptInvite);
router.post("/rejectInvite/:playerId", authenticateUser, rejectInvite);

module.exports = router;
