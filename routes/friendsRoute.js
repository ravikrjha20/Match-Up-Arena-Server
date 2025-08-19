const express = require("express");
const router = express.Router();

const {
  authenticateUser,
  authorizePermissions,
} = require("../middleware/authentication");

const {
  getAllFriends,
  sendRequest,
  getOutgoingRequests,
  getIncomingRequests,
  searchUsers,
  acceptRequest,
  removeFriend,
  declineRequest,
  getUserProfile,
  cancelRequest,
} = require("../controllers/friendController");

// ✅ Get a list of all friends of the logged-in user (full user details)
router.get("/getallfriend", authenticateUser, getAllFriends);

// ✅ Send a friend request to a user by their ID
router.post("/request/:friendId", authenticateUser, sendRequest);

// ✅ Accept an incoming friend request from a user by their ID
router.post("/accept/:friendId", authenticateUser, acceptRequest);

// ⛔ TODO: Decline a friend request (controller not yet implemented)
router.post("/decline/:friendId", authenticateUser, declineRequest);
router.post("/cancelRequest/:friendId", authenticateUser, cancelRequest);

// ✅ Remove a user from the current user's friend list
router.delete("/remove/:friendId", authenticateUser, removeFriend);

// ✅ Search for users by username or name (public route)
router.get("/search", searchUsers);

router.get("/suggestions", searchUsers);
// ⛔ TODO: Get all friend connections or suggestions? (controller not yet implemented)

// ✅ Get all incoming friend requests for the logged-in user
router.get("/incoming", authenticateUser, getIncomingRequests);

// ✅ Get all outgoing friend requests made by the logged-in user
router.get("/outgoing", authenticateUser, getOutgoingRequests);

router.get("/list", authenticateUser);

router.get("/profile/:username", getUserProfile);
module.exports = router;
