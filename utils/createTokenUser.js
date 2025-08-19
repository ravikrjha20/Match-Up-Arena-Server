const createTokenUser = (user) => {
  return {
    name: user.name,
    userId: user._id,
    image: user.image,
    email: user.email,
    username: user.username,
  };
};

module.exports = createTokenUser;
