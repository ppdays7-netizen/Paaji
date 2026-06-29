/** controllers/authController.js — login / logout flow. */
const store = require('../server/store');

exports.showLogin = (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { title: 'SECURE LOGIN' });
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    req.session.flash = { type: 'error', message: 'Credentials incomplete.' };
    return res.redirect('/login');
  }

  try {
    const user = await store.verifyUser(username, password);
    if (!user) {
      req.session.flash = { type: 'error', message: 'ACCESS DENIED — invalid credentials.' };
      return res.redirect('/login');
    }

    // Establish the session.
    req.session.user = { username: user.username, rank: user.rank };
    const dest = req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    req.session.flash = { type: 'success', message: `CLEARANCE VERIFIED — welcome, ${user.rank} ${user.username}.` };
    return res.redirect(dest);
  } catch (err) {
    console.error('[auth] login error', err);
    req.session.flash = { type: 'error', message: 'System error during authentication.' };
    return res.redirect('/login');
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('dhurandar.sid');
    res.redirect('/login');
  });
};
