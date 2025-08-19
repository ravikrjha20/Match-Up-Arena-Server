const mongoose = require("mongoose");
const User = require("../model/userModel");
const UserFriend = require("../model/userFriends");
const CustomError = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { io } = require("../db/socket");
const { getReceiverSocketId } = require("../db/storeSocket");

/**
 * Helper to emit safely (won't throw if offline)
 */
const emitToUser = (userId, event) => {
  const socketId = getReceiverSocketId(userId);
  if (socketId) {
    io.to(socketId).emit(event);
  }
};

const sendRequest = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { friendId } = req.params;

    if (userId === friendId) {
      throw new CustomError.BadRequestError("Cannot request yourself");
    }

    const friend = await User.findById(friendId);
    if (!friend) throw new CustomError.NotFoundError("User not found");

    let userNet = await UserFriend.findOne({ userId });
    let friendNet = await UserFriend.findOne({ userId: friendId });

    if (!userNet) userNet = await UserFriend.create({ userId });
    if (!friendNet) friendNet = await UserFriend.create({ userId: friendId });

    if (userNet.friends.some((f) => f.friendId.equals(friendId)))
      throw new CustomError.BadRequestError("Already friends");

    if (userNet.outgoingRequests.some((r) => r.friendId.equals(friendId)))
      throw new CustomError.BadRequestError("Already requested");

    if (userNet.incomingRequests.some((r) => r.friendId.equals(friendId)))
      throw new CustomError.BadRequestError("They already sent you a request");

    userNet.outgoingRequests.push({ friendId });
    friendNet.incomingRequests.push({ friendId: userId });

    await userNet.save();
    await friendNet.save();

    // Emit updates
    emitToUser(friendId, "updateIncomingRequest");
    emitToUser(userId, "updateOutgoingReq");

    res.status(StatusCodes.OK).json({ msg: "Request sent" });
  } catch (err) {
    next(err);
  }
};

const cancelRequest = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { friendId } = req.params;

    const senderNet = await UserFriend.findOne({ userId });
    const recipientNet = await UserFriend.findOne({ userId: friendId });

    if (
      !senderNet ||
      !senderNet.outgoingRequests.some((r) => r.friendId.equals(friendId))
    ) {
      throw new CustomError.NotFoundError("Friend request not found.");
    }

    senderNet.outgoingRequests.pull({ friendId });
    if (recipientNet) {
      recipientNet.incomingRequests.pull({ friendId: userId });
    }

    await senderNet.save();
    if (recipientNet) {
      await recipientNet.save();
    }

    // Emit updates
    emitToUser(friendId, "updateIncomingRequest");
    emitToUser(userId, "updateOutgoingReq");

    res.status(StatusCodes.OK).json({ msg: "Request canceled successfully" });
  } catch (err) {
    next(err);
  }
};

const acceptRequest = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { friendId } = req.params;

    const userNet = await UserFriend.findOne({ userId });
    const friendNet = await UserFriend.findOne({ userId: friendId });

    if (!userNet || !friendNet)
      throw new CustomError.NotFoundError("Network(s) not found");

    const incomingIdx = userNet.incomingRequests.findIndex((r) =>
      r.friendId.equals(friendId)
    );
    const outgoingIdx = friendNet.outgoingRequests.findIndex((r) =>
      r.friendId.equals(userId)
    );

    if (incomingIdx === -1 || outgoingIdx === -1)
      throw new CustomError.BadRequestError("No such request");

    userNet.incomingRequests.splice(incomingIdx, 1);
    friendNet.outgoingRequests.splice(outgoingIdx, 1);

    userNet.friends.push({ friendId });
    friendNet.friends.push({ friendId: userId });

    await userNet.save();
    await friendNet.save();

    // Emit updates
    emitToUser(userId, "updateFriendList");
    emitToUser(friendId, "updateFriendList");

    res.status(StatusCodes.OK).json({ msg: "Friend request accepted" });
  } catch (err) {
    next(err);
  }
};

const declineRequest = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { friendId } = req.params;

    const userNet = await UserFriend.findOne({ userId });
    const friendNet = await UserFriend.findOne({ userId: friendId });

    if (!userNet || !friendNet)
      throw new CustomError.NotFoundError("Network(s) not found");

    const incomingIdx = userNet.incomingRequests.findIndex((r) =>
      r.friendId.equals(friendId)
    );
    const outgoingIdx = friendNet.outgoingRequests.findIndex((r) =>
      r.friendId.equals(userId)
    );

    if (incomingIdx === -1 || outgoingIdx === -1)
      throw new CustomError.BadRequestError("No such request");

    userNet.incomingRequests.splice(incomingIdx, 1);
    friendNet.outgoingRequests.splice(outgoingIdx, 1);

    await userNet.save();
    await friendNet.save();

    // Emit updates
    emitToUser(userId, "updateIncomingRequest");
    emitToUser(friendId, "updateOutgoingReq");

    res.status(StatusCodes.OK).json({ msg: "Friend request declined" });
  } catch (err) {
    next(err);
  }
};

const removeFriend = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { friendId } = req.params;
    const userNet = await UserFriend.findOne({ userId });
    const friendNet = await UserFriend.findOne({ userId: friendId });

    if (!userNet || !friendNet)
      throw new CustomError.NotFoundError("Network(s) not found");

    userNet.friends = userNet.friends.filter(
      (f) => !f.friendId.equals(friendId)
    );
    friendNet.friends = friendNet.friends.filter(
      (f) => !f.friendId.equals(userId)
    );

    await userNet.save();
    await friendNet.save();

    // Emit updates
    emitToUser(userId, "friendRemoved");
    emitToUser(friendId, "friendRemoved");

    res.status(StatusCodes.OK).json({ msg: "Friend removed" });
  } catch (err) {
    next(err);
  }
};

const searchUsers = async (req, res, next) => {
  try {
    const q = req.query.name || req.query.username || "";
    if (!q) return res.json({ suggestions: [] });

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ],
    })
      .select("_id name username image")
      .limit(20)
      .lean();

    const seen = new Set();
    const uniqueUsers = users.filter((user) => {
      const idStr = user._id.toString();
      if (seen.has(idStr)) return false;
      seen.add(idStr);
      return true;
    });

    res.status(200).json({ suggestions: uniqueUsers });
  } catch (err) {
    next(err);
  }
};

const getUserProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!username) {
      throw new CustomError.BadRequestError("Username is required");
    }

    const user = await User.findOne({ username }).select(
      "username avatar rating wins losses draws coins createdAt name"
    );

    if (!user) {
      throw new CustomError.NotFoundError("User not found");
    }

    res.status(200).json({ profile: user });
  } catch (error) {
    next(error);
  }
};

const getFriends = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const userNet = await UserFriend.findOne({ userId }).populate(
      "friends.friendId",
      "name username image isOnline"
    );
    if (!userNet) return res.json([]);
    res.status(StatusCodes.OK).json(userNet.friends);
  } catch (err) {
    next(err);
  }
};

const getIncomingRequests = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const userNet = await UserFriend.findOne({ userId }).populate(
      "incomingRequests.friendId",
      "name username image"
    );
    const requests = userNet ? userNet.incomingRequests : [];
    res.status(StatusCodes.OK).json({ requests });
  } catch (err) {
    next(err);
  }
};

const getOutgoingRequests = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const userNet = await UserFriend.findOne({ userId }).populate(
      "outgoingRequests.friendId",
      "name username image"
    );
    res
      .status(StatusCodes.OK)
      .json({ requests: userNet ? userNet.outgoingRequests : [] });
  } catch (err) {
    next(err);
  }
};

const getAllFriends = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const userNet = await UserFriend.findOne({ userId }).populate(
      "friends.friendId",
      "name username image isOnline"
    );
    const friends = userNet ? userNet.friends.map((f) => f.friendId) : [];
    res.status(StatusCodes.OK).json({ friends });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendRequest,
  acceptRequest,
  declineRequest,
  removeFriend,
  searchUsers,
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  getAllFriends,
  getUserProfile,
  cancelRequest,
};
