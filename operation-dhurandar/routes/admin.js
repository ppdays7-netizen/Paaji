/** routes/admin.js — Brigadier-only command centre. Every route double-gated. */
const express = require('express');
const router = express.Router();
const admin = require('../controllers/adminController');
const { ensureAuth, ensureBrigadier } = require('../middleware/auth');

// Gate the entire router: must be logged in AND a Brigadier.
router.use(ensureAuth, ensureBrigadier);

router.get('/', admin.panel);

// Members
router.post('/members/add', admin.addMember);
router.post('/members/edit', admin.editMember);
router.post('/members/delete', admin.deleteMember);

// Advanced dossier — full profile, posting, achievements
router.post('/members/profile', admin.updateProfile);
router.post('/members/posting', admin.updatePosting);
router.post('/members/achievements/add', admin.addAchievement);
router.post('/members/achievements/remove', admin.removeAchievement);

// Points
router.post('/points/adjust', admin.adjustPoints);
router.post('/points/reset', admin.resetPoints);

// Missions
router.post('/missions/add', admin.addMission);
router.post('/missions/edit', admin.editMission);
router.post('/missions/delete', admin.deleteMission);

module.exports = router;
