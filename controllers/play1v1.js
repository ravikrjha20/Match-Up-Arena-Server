const User = require("../model/userModel");
const userFriend = require("../model/userFriends");
const matchHistory = require("../model/matchHistory");
const { checkWin } = require("../Logic/Logic");
const {
  getReceiverSocketId,
  io,
  matchQueue,
  createMatch,
} = require("../db/socket");

const { delCache, redisKey } = require("../utils/redisHelper");
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
function calculateNewRating(
  ratingUser,
  ratingOpponent,
  win,
  isFriendMatch,
  K = 30
) {
  if (isFriendMatch) {
    return {
      newRating: ratingUser,
      ratingChange: 0,
    };
  }
  const expectedScore =
    1 / (1 + Math.pow(10, (ratingOpponent - ratingUser) / 400));
  const actualScore = win ? 1 : 0;
  const newRating = ratingUser + K * (actualScore - expectedScore);
  const ratingChange = newRating - ratingUser;
  return {
    newRating: Math.round(newRating),
    ratingChange: Number(ratingChange.toFixed(2)),
  };
}

const storeMatchHistory = async (
  player1Id,
  player2Id,
  player1Result,
  player2Result,
  isFriendMatch
) => {
  try {
    // 1. Fetch both users
    const [player1, player2] = await Promise.all([
      User.findById(player1Id),
      User.findById(player2Id),
    ]);

    if (!player1 || !player2) throw new Error("One or both users not found");

    // 2. Calculate new ratings
    const player1Win = player1Result === "win";
    const player2Win = player2Result === "win";

    const { newRating: newRating1, ratingChange: ratingChange1 } =
      calculateNewRating(
        player1.rating,
        player2.rating,
        player1Win,
        isFriendMatch
      );
    const { newRating: newRating2, ratingChange: ratingChange2 } =
      calculateNewRating(
        player2.rating,
        player1.rating,
        player2Win,
        isFriendMatch
      );

    // 3. Save match in MatchHistory collection
    await matchHistory.create({
      player1: {
        id: player1._id,
        name: player1.username,
        avatar: player1.avatar,
        result: player1Result,
        ratingChange: ratingChange1,
        newRating: newRating1,
      },
      player2: {
        id: player2._id,
        name: player2.username,
        avatar: player2.avatar,
        result: player2Result,
        ratingChange: ratingChange2,
        newRating: newRating2,
      },
    });
    await Promise.all([
      User.findByIdAndUpdate(player1Id, {
        $inc: {
          wins: player1Result === "win" ? 1 : 0,
          losses: player1Result === "loss" ? 1 : 0,
          draws: player1Result === "draw" ? 1 : 0,
        },
        $push: {
          matches: {
            opponent: player2._id,
            opponentName: player2.username,
            opponentAvatar: player2.avatar,
            result: player1Result,
            mode: "1v1",
            ratingChange: ratingChange1,
            newRating: isFriendMatch ? player1.rating : newRating1,
          },
        },
        $set: { rating: newRating1 },
      }),
      User.findByIdAndUpdate(player2Id, {
        $inc: {
          wins: player2Result === "win" ? 1 : 0,
          losses: player2Result === "loss" ? 1 : 0,
          draws: player2Result === "draw" ? 1 : 0,
        },
        $push: {
          matches: {
            opponent: player1._id,
            opponentName: player1.username,
            opponentAvatar: player1.avatar,
            result: player2Result,
            mode: "1v1",
            ratingChange: ratingChange2,
            newRating: isFriendMatch ? player2.rating : newRating2,
          },
        },
        $set: { rating: newRating2 },
      }),
    ]);
    await delCache([redisKey("user", player1Id), redisKey("user", player2Id)]);
    // 5. Update head-to-head stats if friends
    if (isFriendMatch) {
      await Promise.all([
        userFriend.updateOne(
          { userId: player1Id, "friends.friendId": player2Id },
          {
            $inc: {
              "friends.$.wins": player1Result === "win" ? 1 : 0,
              "friends.$.losses": player1Result === "loss" ? 1 : 0,
              "friends.$.draws": player1Result === "draw" ? 1 : 0,
            },
          }
        ),
        userFriend.updateOne(
          { userId: player2Id, "friends.friendId": player1Id },
          {
            $inc: {
              "friends.$.wins": player2Result === "win" ? 1 : 0,
              "friends.$.losses": player2Result === "loss" ? 1 : 0,
              "friends.$.draws": player2Result === "draw" ? 1 : 0,
            },
          }
        ),
      ]);
    }

    console.log(
      `✅ Match history saved: ${player1.username} vs ${player2.username}`
    );
  } catch (error) {
    console.error("❌ Error storing match history:", error);
    throw error;
  }
};

const MATCH_TIMEOUT_MS = 30000; // 30 seconds

const playWithRandomOnlineUser = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const currentUserName = req.user.username || req.user.name;

    // 🚫 Already in queue
    if (matchQueue.has(currentUserId)) {
      return res
        .status(200)
        .json({ message: "Already searching for a match." });
    }

    // Get all waiting players
    const queueIds = Array.from(matchQueue.keys());
    const opponentUserId = queueIds.find((id) => id !== currentUserId);

    if (opponentUserId) {
      // --- Match Found ---
      const opponentTimeoutId = matchQueue.get(opponentUserId);
      clearTimeout(opponentTimeoutId);
      matchQueue.delete(opponentUserId);

      const currentSocketId = getReceiverSocketId(currentUserId);
      const opponentSocketId = getReceiverSocketId(opponentUserId);

      if (!currentSocketId || !opponentSocketId) {
        console.warn("⚠ Match aborted — one or both players disconnected");
        if (currentSocketId) addPlayerToQueue(currentUserId);
        if (opponentSocketId) addPlayerToQueue(opponentUserId);
        return res
          .status(200)
          .json({ message: "Opponent disconnected, retrying..." });
      }

      const opponentData = await User.findById(opponentUserId).select(
        "username name avatar"
      );
      if (!opponentData) {
        console.warn("⚠ Opponent data missing — retrying match");
        addPlayerToQueue(currentUserId);
        return res.status(404).json({ message: "Opponent not found." });
      }

      const opponentName = opponentData.username || opponentData.name;

      // ✅ Create match and get matchId
      const matchData = createMatch(currentUserId, opponentUserId);

      // Notify both players
      io.to(currentSocketId).emit("matchFound", {
        matchId: matchData.matchId, // ✅ send matchId
        opponentId: opponentUserId,
        opponentName,
        opponentAvatar: opponentData.avatar,
        mark: "X",
        opponentMark: "O",
        turn: true, // X starts first
        status: "ongoing",
      });

      io.to(opponentSocketId).emit("matchFound", {
        matchId: matchData.matchId, // ✅ send matchId
        opponentId: currentUserId,
        opponentName: currentUserName,
        opponentAvatar: req.user.avatar,
        mark: "O",
        opponentMark: "X",
        turn: false,
        status: "ongoing",
      });

      console.log(
        `✅ Match found: ${currentUserName} vs ${opponentName} (Match ID: ${matchData.matchId})`
      );
      return res.status(200).json({
        message: "Match found",
        opponentId: opponentUserId,
        matchId: matchData.matchId,
      });
    }

    // --- No Opponent Found — Add to Queue ---
    addPlayerToQueue(currentUserId);

    console.log(`⏳ User ${currentUserId} added to match queue.`);
    return res.status(200).json({ message: "Searching for opponent..." });
  } catch (error) {
    console.error("❌ Matchmaking Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const playOneVOne = async (req, res) => {
  try {
    const userId = req.user.userId;
    const opponentId = req.params.opponentId;
    const { mask, opponentMask, isFriend, opponentName } = req.body;

    const userSocketId = getReceiverSocketId(userId);
    const opponentSocketId = getReceiverSocketId(opponentId);

    if (!userSocketId || !opponentSocketId) {
      return res
        .status(400)
        .json({ message: "One or both players are offline" });
    }

    // Determine game status
    let statusUser = "ongoing";
    let statusOpponent = "ongoing";

    if (checkWin(mask)) {
      statusUser = "win";
      statusOpponent = "loss";
    } else if (checkWin(opponentMask)) {
      statusUser = "loss";
      statusOpponent = "win";
    } else if ((mask | opponentMask) === 0b111111111) {
      statusUser = "draw";
      statusOpponent = "draw";
    }

    // If game is over, store the result
    if (statusUser !== "ongoing") {
      await storeMatchHistory(
        userId,
        opponentId,
        statusUser,
        statusOpponent,
        isFriend
      );
    }

    // Send move + status to user
    io.to(userSocketId).emit("gameMove", {
      userMask: mask,
      opponentMask: opponentMask,
      turn: false,
      status: statusUser,
    });

    // Send move + status to opponent
    io.to(opponentSocketId).emit("gameMove", {
      userMask: opponentMask,
      opponentMask: mask,
      turn: true,
      status: statusOpponent,
    });

    return res.status(200).json({
      message: "Move sent successfully",
      status: statusUser,
    });
  } catch (error) {
    console.error("❌ playOneVOne error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { playWithRandomOnlineUser, playOneVOne };
