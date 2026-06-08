const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

// Add utility for handling authentication
const authenticate = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('Invalid email or password');
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error('Invalid email or password');
  }
  return user;
};

exports.register = async (req, res) => {
  try {
    const user = new User(req.body);
    user.password = await bcrypt.hash(user.password, 10);
    await user.save();
    const token = generateToken(user._id);
    res.status(201).json({ success: true, token, user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const user = await authenticate(req.body.email, req.body.password);
    const token = generateToken(user._id);
    res.status(200).json({ success: true, token, user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
// Existing methods like getProfile, logout, etc.
