/**
 * Operation DHURANDAR — Restricted Military Personnel Portal
 * =========================================================
 * FICTIONAL ENTERTAINMENT PROJECT. Movie-inspired. Not affiliated with,
 * and does not use real assets, logos, branding, or classified data of,
 * any real armed force or government. All names, ranks, "missions", and
 * locations are invented for a college demonstration.
 *
 * Stack: Node.js + Express + EJS + session auth + flat-file storage.
 */

const path = require('path');
const express = require('express');
const session = require('express-session');

const { attachUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

/* ----------------------------- view engine ------------------------------ */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ------------------------------ middleware ------------------------------ */
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    name: 'dhurandar.sid',
    secret: process.env.SESSION_SECRET || 'dhurandar-classified-demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 30, // 30-minute session timeout
      sameSite: 'lax',
    },
  })
);

// Expose currentUser + flash messages to every template.
app.use(attachUser);

/* -------------------------------- routes -------------------------------- */
app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

/* ----------------------------- error handling --------------------------- */
// 404 — page not found
app.use((req, res) => {
  res.status(404).render('404', { title: 'SECTOR NOT FOUND' });
});

// 500 — never crash; render a themed error instead
app.use((err, req, res, next) => {
  console.error('[server] unhandled error:', err);
  res.status(500).render('error', {
    title: 'SYSTEM FAULT',
    message: 'An unexpected fault occurred in the secure system.',
  });
});

/* ------------------------------- launch --------------------------------- */
// Export the app for serverless platforms (Vercel); listen locally.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ██ OPERATION DHURANDAR ██  secure portal online`);
    console.log(`  → http://localhost:${PORT}\n`);
  });
}

module.exports = app;
