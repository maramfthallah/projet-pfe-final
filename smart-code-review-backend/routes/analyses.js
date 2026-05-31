const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createAnalysis,
  getAnalyses,
  getDashboardStats,
  getAnalysisById,
  deleteAnalysis,
} = require('../controllers/analysisController');

// Middleware de protection
router.use(protect);

// Routes
router.post('/', createAnalysis);
router.get('/', getAnalyses);
router.get('/dashboard', getDashboardStats);
router.get('/:id', getAnalysisById);
router.delete('/:id', deleteAnalysis);

module.exports = router;