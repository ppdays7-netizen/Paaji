/** routes/api.js — JSON endpoints for live UI (logged-in users). */
const express = require('express');
const router = express.Router();
const api = require('../controllers/apiController');
const { ensureAuth } = require('../middleware/auth');

router.post('/missions/complete', ensureAuth, api.completeMission);
router.get('/leaderboard', ensureAuth, api.leaderboard);

module.exports = router;
