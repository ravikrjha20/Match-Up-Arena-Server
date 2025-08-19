const User = require("../model/userModel");
const CustomError = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { createTokenUser, attachCookiesToResponse } = require("../utils");

const register = async (req, res) => {
  const { name, username, email, password } = req.body;

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

  const user = await User.create({ name, username, email, password });

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
};
