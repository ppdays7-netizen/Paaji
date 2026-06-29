/** routes/dashboard.js — public landing + protected member pages. */
const express = require('express');
const router = express.Router();
const dash = require('../controllers/dashboardController');
const { ensureAuth } = require('../middleware/auth');

// Public
router.get('/', dash.landing);

// Protected
router.get('/dashboard', ensureAuth, dash.dashboard);
router.get('/map', ensureAuth, dash.map);
router.get('/leaderboard', ensureAuth, dash.leaderboard);
router.get('/profile', ensureAuth, dash.profile);
router.get('/profile/:username', ensureAuth, dash.profile);

module.exports = router;
