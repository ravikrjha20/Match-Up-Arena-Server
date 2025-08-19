const { v4: uuidv4 } = require("uuid");
const { io } = require("./socket");
const userSocketMap = {}; // { userId: socketId }
const matchQueue = new Map(); // { userId: timeoutId }
const currentMatches = new Map(); // matchId -> { matchId, player1Id, player2Id, createdAt }
const MATCH_TIMEOUT_MS = 30000;
const getReceiverSocketId = (userId) => userSocketMap[userId];
const activeInvites = new Map();
const User = require("../model/userModel");
function addInvite(
  playerId,
  opponentId,
  opponentName,
  playerName,
  timeoutId = null
) {
  activeInvites.set(playerId, {
    playerId,
    opponentId,
    opponentName,
    playerName,
    timeoutId,
  });
}
function removeInvite(playerId) {
  if (activeInvites.has(playerId)) {
    clearTimeout(activeInvites.get(playerId).timeoutId);
    activeInvites.delete(playerId);
  }
}
function getInvite(playerId) {
  return activeInvites.get(playerId) || null;
}
function createMatch(player1Id, player2Id) {
  const matchId = uuidv4();
  const matchData = {
    matchId,
    player1Id,
    player2Id,
    createdAt: Date.now(),
  };
  currentMatches.set(matchId, matchData);
  return matchData;
}
function cancelPlayerSearch(userId) {
  if (matchQueue.has(userId)) {
    clearTimeout(matchQueue.get(userId));
    matchQueue.delete(userId);
    console.log(`🚫 Matchmaking cancelled for user: ${userId}`);
  }
}
function getMatchByPlayerId(playerId) {
  for (let match of currentMatches.values()) {
    if (match.player1Id == playerId || match.player2Id == playerId) {
      return match;
    }
  }
  return null;
}
function removeMatch(matchId) {
  return currentMatches.delete(matchId);
}
function addPlayerToQueue(userId) {
  const timeoutId = setTimeout(() => {
    if (matchQueue.has(userId)) {
      matchQueue.delete(userId);
      const socketId = getReceiverSocketId(userId);
      if (socketId) {
        io.to(socketId).emit("matchTimeout", {
          message: "No opponent found in time.",
        });
      }
      console.log(`⌛ Matchmaking timeout for user: ${userId}`);
    }
  }, MATCH_TIMEOUT_MS);
  matchQueue.set(userId, timeoutId);
}
module.exports = {
  getReceiverSocketId,
  createMatch,
  getMatchByPlayerId,
  removeMatch,
  userSocketMap,
  matchQueue,
  currentMatches,
  cancelPlayerSearch,
  addPlayerToQueue,
  addInvite,
  removeInvite,
  getInvite,
  activeInvites,
};
