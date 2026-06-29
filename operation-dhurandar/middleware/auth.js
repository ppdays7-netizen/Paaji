/**
 * middleware/auth.js — authentication & role-based access control.
 */

/** Make the logged-in user available to every view as `currentUser`. */
function attachUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
}

/** Block unauthenticated requests — redirect to the login screen. */
function ensureAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  // Remember where they were headed so we can bounce back after login.
  req.session.returnTo = req.originalUrl;
  req.session.flash = { type: 'error', message: 'AUTHENTICATION REQUIRED — restricted sector.' };
  return res.redirect('/login');
}

/** Only the Brigadier (highest authority) may pass. Everyone else: ACCESS DENIED. */
function ensureBrigadier(req, res, next) {
  if (req.session && req.session.user && req.session.user.rank === 'Brigadier') {
    return next();
  }
  res.status(403);
  // API/JSON callers get JSON; page navigations get the themed denial screen.
  if (req.xhr || (req.headers.accept || '').includes('application/json')) {
    return res.json({ ok: false, error: 'ACCESS DENIED — insufficient clearance.' });
  }
  return res.render('denied', {
    title: 'ACCESS DENIED',
    reason: 'This sector requires BRIGADIER clearance.',
  });
}

module.exports = { attachUser, ensureAuth, ensureBrigadier };
