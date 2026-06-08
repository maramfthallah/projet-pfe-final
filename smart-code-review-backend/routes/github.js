const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
  getRepos,
  getBranches,
  getRepoTree,
  getFileContent,
} = require('../controllers/githubController');
const {
  pushChanges,
} = require('../controllers/pushController');

// All routes should be protected
router.use(protect);

// Repository routes
router.get('/repos',                          getRepos);
router.get('/repos/:owner/:repo/branches',    getBranches);
router.get('/repos/:owner/:repo/tree',        getRepoTree);
router.get('/repos/:owner/:repo/contents/*',  getFileContent);

// Push route
router.post('/repos/:owner/:repo/push',       pushChanges);

module.exports = router;
