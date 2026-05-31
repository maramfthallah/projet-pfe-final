const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
  register,
  login,
  githubAuth,
  githubCallback,
  getProfile,
  logout,
} = require('../controllers/authController');

// Local Auth
router.post('/register', register);
router.post('/login', login);

// GitHub OAuth
router.get('/github',          githubAuth);
router.get('/github/callback', githubCallback);

// Google OAuth
router.get('/google',          require('../controllers/authController').googleAuth);
router.get('/google/callback', require('../controllers/authController').googleCallback);

// Protected routes
router.get('/profile', protect, getProfile);
router.post('/logout', protect, logout);

module.exports = router;