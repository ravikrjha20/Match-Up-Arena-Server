const User = require("../model/userModel");
const { getReceiverSocketId, io, createMatch } = require("../db/socket");
const {
  addInvite,
  removeInvite,
  getInvite,
  activeInvites,
} = require("../db/storeSocket");
// Send 1v1 invite
const inviteOneVone = async (req, res) => {
  try {
    const playerId = req.user.userId;
    const playerName = req.user.username || req.user.name;
    const opponentId = req.params.friendId;
    const opponentSocketId = getReceiverSocketId(opponentId);
    if (!opponentSocketId)
      return res.status(400).json({ message: "Opponent not online." });
    const opponentData = await User.findById(opponentId).select(
      "username name"
    );
    if (!opponentData)
      return res.status(404).json({ message: "Opponent not found." });
    const opponentName = opponentData.username || opponentData.name;
    // Send invite notification
    io.to(opponentSocketId).emit("friendInvite", {
      fromId: playerId,
      fromName: playerName,
    });
    // Store in invite container
    addInvite(playerId, opponentId, opponentName, req.user.username);
    return res.status(200).json({ message: "Invite sent" });
  } catch (error) {
    console.error("❌ Invite Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
// Accept 1v1 invite
const acceptInvite = async (req, res) => {
  try {
    const opponentId = req.user.userId; // The one accepting the invite
    const playerId = req.params.playerId; // Id of the user who invited
    const invite = getInvite(playerId);

    console.log(invite);
    if (!invite || invite.opponentId !== opponentId) {
      return res
        .status(400)
        .json({ message: "Invite not found or already cancelled." });
    }
    // Remove invite from container
    removeInvite(playerId);
    const playerSocketId = getReceiverSocketId(playerId);
    const opponentSocketId = getReceiverSocketId(opponentId);
    // Create match
    const matchData = createMatch(playerId, opponentId);
    if (!playerSocketId || !opponentSocketId) {
      return res
        .status(400)
        .json({ message: "One of the players is offline." });
    }
    // Notify both users
    io.to(playerSocketId).emit("matchFoundFriend", {
      matchId: matchData.matchId,
      opponentId,
      opponentName: req.user.username || req.user.name,
      mark: "X",
      opponentMark: "O",
      turn: true,
      status: "ongoing",
    });
    io.to(opponentSocketId).emit("matchFoundFriend", {
      matchId: matchData.matchId,
      opponentId: playerId,
      opponentName: invite.playerName || "Opponent",
      mark: "O",
      opponentMark: "X",
      turn: false,
      status: "ongoing",
    });
    console.log("hey here is issue 1");
    return res.status(200).json({ message: "Invite accepted, match started." });
  } catch (error) {
    console.error("❌ Accept Invite Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
// Cancel/Remove invite
const cancelInvite = async (req, res) => {
  try {
    const playerId = req.user.userId;
    const invite = getInvite(playerId);
    if (!invite) return res.status(400).json({ message: "No active invite." });
    const opponentSocketId = getReceiverSocketId(invite.opponentId);
    if (opponentSocketId) {
      io.to(opponentSocketId).emit("inviteCancelled", { fromId: playerId });
    }
    removeInvite(playerId);
    return res.status(200).json({ message: "Invite cancelled." });
  } catch (error) {
    console.error("❌ Cancel Invite Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const rejectInvite = (req, res) => {
  try {
    const opponentId = req.user.userId; // the person rejecting
    const inviterId = req.params.playerId; // ID of the person who sent the invite
    const invite = getInvite(inviterId);
    console.log(invite);
    console.log(activeInvites);
    if (!invite || invite.opponentId !== opponentId) {
      return res.status(404).json({ message: "No matching invite found." });
    }
    removeInvite(inviterId);
    // Notify inviter via Socket.IO
    const inviterSocketId = getReceiverSocketId(inviterId);
    if (inviterSocketId) {
      io.to(inviterSocketId).emit("inviteRejected", {
        opponentId,
        message: `${req.user.username || "Opponent"} rejected your invite.`,
      });
    }
    return res.status(200).json({ message: "Invite rejected successfully." });
  } catch (error) {
    console.error("Error rejecting invite:", error);
    return res.status(500).json({ message: "Server error." });
  }
};
module.exports = { rejectInvite, inviteOneVone, acceptInvite, cancelInvite };
