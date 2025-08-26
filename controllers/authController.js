const User = require("../model/userModel");
const CustomError = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { createTokenUser, attachCookiesToResponse } = require("../utils");

const register = async (req, res) => {
  const { name, username, email, password, avatar } = req.body;

  if (!name || !username || !email || !password) {
    throw new CustomError.BadRequestError(
      "Please provide all required credentials"
    );
  }

  const emailExists = await User.findOne({ email });
  if (emailExists) {
    throw new CustomError.BadRequestError("Email already in use");
  }

  const usernameExists = await User.findOne({ username });
  if (usernameExists) {
    throw new CustomError.BadRequestError("Username already taken");
  }

  if (/\s/.test(username)) {
    throw new CustomError.BadRequestError("Username cannot contain spaces");
  }

  const user = await User.create({
    name,
    username,
    email,
    password,
    avatar,
  });

  const tokenUser = createTokenUser(user);
  attachCookiesToResponse({ res, user: tokenUser });

  // Remove password from response
  const { password: _, ...safeUser } = user._doc;

  res.status(StatusCodes.CREATED).json({ user: safeUser });
};
const login = async (req, res) => {
  const { identifier, password } = req.body; // 'identifier' can be email OR username
  if (!identifier || !password) {
    throw new CustomError.BadRequestError(
      "Please provide email/username and password"
    );
  }

  // Search by either email OR username
  const user = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  });

  if (!user) {
    throw new CustomError.UnauthenticatedError("Invalid credentials");
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new CustomError.UnauthenticatedError("Invalid credentials");
  }

  const tokenUser = createTokenUser(user);
  attachCookiesToResponse({ res, user: tokenUser });

  // Remove password from response
  const { password: _, ...safeUser } = user._doc;

  res.status(StatusCodes.OK).json({ user: safeUser });
};
const logout = (req, res) => {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    signed: true,
    path: "/",
  };
  res.clearCookie("accessToken", options);
  res.clearCookie("refreshToken", options);
  res.status(StatusCodes.OK).json({ msg: "User logged out!" });
};

const updateProfile = async (req, res) => {
  try {
    const { name, username, email, previousPassword, password, avatar } =
      req.body;
    const userId = req.user.userId;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    if ((email && email !== user.email) || password) {
      if (!previousPassword) {
        return res.status(400).json({
          msg: "Previous password is required to update email or password",
        });
      }
      const isMatch = await user.comparePassword(previousPassword);
      if (!isMatch) {
        return res.status(400).json({ msg: "Previous password is incorrect" });
      }
    }
    // Update non-password fields if provided
    if (name) user.name = name;
    if (username) user.username = username;
    if (email) user.email = email;
    if (avatar) user.avatar = avatar;
    if (password) user.password = password;

    await user.save();
    const { password: _, ...updatedUser } = user.toObject();
    res
      .status(200)
      .json({ msg: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server error" });
  }
};

const checkAuth = async (req, res) => {
  const user = await User.findOne({ email: req.user.email });

  // Remove password from response
  const { password: _, ...safeUser } = user._doc;

  res.status(StatusCodes.OK).json({ user: safeUser });
};

module.exports = {
  register,
  login,
  logout,
  checkAuth,
  updateProfile,
};
