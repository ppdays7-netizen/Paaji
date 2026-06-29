<div align="center">

# 🛡️ OPERATION **DHURANDAR**
### `Restricted Military Personnel Portal`

![status](https://img.shields.io/badge/STATUS-CLASSIFIED-0a0?style=for-the-badge&labelColor=000&color=3fff9f)
![clearance](https://img.shields.io/badge/CLEARANCE-ALPHA-ffd23f?style=for-the-badge&labelColor=000)
![fictional](https://img.shields.io/badge/⚠%20100%25-FICTIONAL-ff4d4d?style=for-the-badge&labelColor=000)

![Node.js](https://img.shields.io/badge/Node.js-18+-3fff9f?style=flat-square&logo=node.js&logoColor=black&labelColor=05080a)
![Express](https://img.shields.io/badge/Express-4.x-3fff9f?style=flat-square&logo=express&logoColor=black&labelColor=05080a)
![EJS](https://img.shields.io/badge/EJS-Templates-3fff9f?style=flat-square&labelColor=05080a)
![Tailwind](https://img.shields.io/badge/TailwindCSS-CDN-58f5ff?style=flat-square&logo=tailwindcss&logoColor=black&labelColor=05080a)
![License](https://img.shields.io/badge/License-MIT-ffd23f?style=flat-square&labelColor=05080a)

> *A movie-inspired, **completely fictional** classified intelligence portal — built for a college demonstration.*

</div>

---

> ## ⚠️ DISCLAIMER — READ FIRST
> **This is a work of fiction made purely for entertainment and educational demonstration.**
> It is **not** affiliated with, endorsed by, or representative of the Indian Army or any real
> armed force or government. It uses **no** real classified information, **no** real logos, **no**
> official branding, and **no** real sensitive locations. Every name, rank, "mission", posting,
> medal, and map pin is **invented**. Inspired by films like *URI*, *Dhurandar*, *Mission: Impossible*,
> and *Call of Duty* briefing screens.

---

## 📡 Project Overview

**Operation DHURANDAR** is a full-stack Node.js web app styled as a premium, dark *military-green
HUD* intelligence terminal. It features a session-based login system, per-officer classified
dossiers, an animated radar **sector map**, a live **leaderboard**, a gamified **mission/XP** system,
and a **Brigadier-only command centre** for managing officers, points, and missions.

There is **no database** — all state lives in simple flat files (`auth.txt`, `points.json`,
`tasks.json`, `members.json`) that the server reads and writes on the fly.

---

## ✨ Features

| Area | What it does |
|------|--------------|
| 🔐 **Auth** | Session login validated against `auth.txt`. No hardcoded users. Logout + session timeout. |
| 🧑‍✈️ **Dossiers** | Each officer gets a classified profile: rank, years, posting, achievements, medals, clearance, XP, progress bar. |
| 🗺️ **Sector Map** | Stylized fictional map with glowing pins, radar sweep, click-to-decrypt posting intel. |
| 🏆 **Leaderboard** | Gold/Silver/Bronze podium, live auto-refresh, levels derived from XP. |
| 🎯 **Missions / XP** | Fun college missions worth XP. Mark complete → instant points. Duplicate completion blocked. |
| ⭐ **Command Centre** | **Brigadier only**: add/edit/delete officers, manage & reset points, create/edit/delete missions. |
| 🚫 **Access Control** | Non-Brigadiers attempting command routes get a themed **ACCESS DENIED — insufficient clearance**. |
| 🎨 **UI/FX** | Particle background, radar sweeps, encrypted grid, scanlines, glassmorphism, typewriter + decryption effects, boot loader, responsive/mobile friendly. |

### 🎬 Boot sequence
On load you'll see the secure boot loader:
```
> ACCESSING SECURE DATABASE...
> ESTABLISHING ENCRYPTED CHANNEL...
> AUTHENTICATING...
> DECRYPTING PERSONNEL RECORDS...
> CLEARANCE VERIFIED.
```

---

## 🧰 Tech Stack

- **Backend:** Node.js + Express.js
- **Views:** EJS server-side templates
- **Styling:** TailwindCSS (Play CDN) + custom HUD stylesheet
- **Icons:** Lucide
- **Auth:** `express-session` (cookie sessions) + `bcryptjs` (optional hashing, ready to enable)
- **Storage:** Flat files — `auth.txt` + JSON (no DB required)
- **Animations:** Vanilla JS (canvas particles, typewriter, decryption, radar) — CSS keyframes

---

## 👥 Officers (fictional)

| Officer | Rank | Posting | Years | Role in Op DHURANDAR |
|--------|------|---------|:----:|----------------------|
| **Piyush** | Brigadier *(highest authority)* | Northern Command | 18 | Mission Planning · Resource Allocation · Final Command |
| **Durvankur** | Colonel | Western Intelligence | 14 | Strategic Analysis |
| **Gaurang** | Major | Eastern Sector | 12 | Logistics · Ground Operations |
| **Vedant** | Lieutenant | Training Command | 6 | Field Execution |

**Demo credentials** — all passwords are `password123`:
`Piyush` · `Gaurang` · `Durvankur` · `Vedant`

---

## 🚀 Installation

> Requires **Node.js 18+**.

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start          # production
npm run dev        # auto-reload (nodemon)

# 3. Open the portal
#    → http://localhost:3000
```

Log in with any officer above (password `password123`). Log in as **Piyush** to unlock the
Brigadier Command Centre.

### Optional environment variables
| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Server port |
| `SESSION_SECRET` | demo string | Session signing secret (set in production!) |
| `HASH_PASSWORDS` | `false` | Set to `true` to store/verify passwords with bcrypt |

---

## 🔐 How Authentication Works

1. **No hardcoded users.** On every login attempt the server reads `data/auth.txt` and parses each
   line as `username,password,rank`. Add or remove a line and the change is live on the **next
   login — no restart required.**
2. **Validation.** Submitted credentials are checked against the parsed list. Plain-text by default
   for the demo; flip `HASH_PASSWORDS=true` and the code transparently uses **bcrypt** instead
   (new officers are then stored hashed, and hashed entries are verified with `bcrypt.compare`).
3. **Sessions.** On success an `express-session` cookie (`dhurandar.sid`) is issued with a
   **30-minute timeout**. The user object (`{ username, rank }`) is stored server-side.
4. **Protection.** `ensureAuth` guards every member route and redirects unauthenticated users to
   `/login`. `ensureBrigadier` further restricts the command centre — anyone else receives
   **ACCESS DENIED**.
5. **Logout.** `/logout` destroys the session and clears the cookie.

```
auth.txt  ──read──▶  verify  ──set──▶  session cookie  ──guarded by──▶  ensureAuth / ensureBrigadier
```

> 🔧 **Enable hashing later:** set `HASH_PASSWORDS=true`. The data layer already branches on this
> flag, so no code changes are needed.

---

## 🗂️ Folder Structure

```
operation-dhurandar/
├── server.js                # App entry — Express setup, sessions, routes, error handling
├── package.json
├── vercel.json              # Vercel serverless config for Express
├── .gitignore
├── README.md
│
├── server/
│   └── store.js             # Flat-file data layer (users, points, missions, members)
│
├── routes/
│   ├── auth.js              # /login, /logout
│   ├── dashboard.js         # /, /dashboard, /map, /leaderboard, /profile
│   ├── admin.js             # /admin/* (Brigadier-gated)
│   └── api.js               # /api/* (JSON: mission completion, leaderboard)
│
├── controllers/
│   ├── authController.js
│   ├── dashboardController.js
│   ├── adminController.js
│   └── apiController.js
│
├── middleware/
│   └── auth.js              # attachUser, ensureAuth, ensureBrigadier
│
├── views/                   # EJS templates
│   ├── partials/            # head, nav, flash, footer, loader
│   ├── landing.ejs  login.ejs  dashboard.ejs  profile.ejs
│   ├── map.ejs  leaderboard.ejs  admin.ejs
│   └── denied.ejs  404.ejs  error.ejs
│
├── public/                  # Static assets
│   ├── css/style.css        # Full HUD theme (radar, glass, animations)
│   ├── js/main.js           # Particles, boot loader, typewriter, live updates
│   └── images/
│
└── data/                    # "Database"
    ├── auth.txt             # username,password,rank  (one per line)
    ├── points.json          # { "Piyush": 520, ... }
    ├── tasks.json           # missions + per-user completions
    └── members.json         # profile metadata per officer
```

---

## 🛡️ Security Notes

- Role middleware (`ensureBrigadier`) + auth middleware (`ensureAuth`) on every protected route.
- Admin router is **double-gated** (auth **and** role) at the router level.
- 30-minute session timeout; `httpOnly`, `sameSite=lax` cookies.
- Input validation in the data layer (no commas/newlines in names, duplicate-name checks,
  non-negative points, duplicate-mission prevention).
- Global error handler renders a themed **SYSTEM FAULT** page instead of crashing.
- ⚠️ For a **real** deployment you would also: enable `HASH_PASSWORDS`, set a strong
  `SESSION_SECRET`, add CSRF protection, rate-limit login, and use a real database.

---

## 🖼️ Screenshots

> _Placeholders — drop your own captures into `public/images/` and update these links._

| Landing | Dashboard | Sector Map |
|---------|-----------|-----------|
| `![Landing](public/images/screenshot-landing.png)` | `![Dashboard](public/images/screenshot-dashboard.png)` | `![Map](public/images/screenshot-map.png)` |

| Leaderboard | Profile / Dossier | Command Centre |
|-------------|-------------------|----------------|
| `![Leaderboard](public/images/screenshot-leaderboard.png)` | `![Profile](public/images/screenshot-profile.png)` | `![Admin](public/images/screenshot-admin.png)` |

---

## 🔭 Future Improvements

- Swap flat files for a real database (SQLite / MongoDB) for true multi-instance persistence.
- Per-user password hashing on by default + password change UI.
- Real-time updates via WebSockets instead of polling.
- Editable achievements/medals from the admin panel.
- Audit log of all command-centre actions.
- Optional military ambient sound + mute toggle.
- Replace the Tailwind Play CDN with a compiled build for production performance.

---

## 🌿 Git — Initialise & Push to GitHub

### 1. Create the GitHub repository
1. Go to **https://github.com/new**.
2. **Repository name:** `operation-dhurandar` (or anything you like).
3. Leave it **empty** — do *not* add a README/.gitignore (you already have them).
4. Choose **Public** or **Private**, then click **Create repository**.
5. Copy the repo URL GitHub shows you, e.g. `https://github.com/USERNAME/operation-dhurandar.git`.

### 2. Push your code
Run these from the project folder:

```bash
git init
git add .
git commit -m "Initial Commit - Operation Dhurandar"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

> Replace `USERNAME` and `REPOSITORY` with your own. After this, every future change is just:
> ```bash
> git add .
> git commit -m "your message"
> git push
> ```

---

## ▲ Deploy on Vercel

This project ships with a `vercel.json` so Express runs as a Vercel serverless function while
`/public` is served statically.

### Option A — Vercel CLI

```bash
# 1. Install the Vercel CLI
npm install -g vercel

# 2. Log in
vercel login

# 3. Deploy a preview
vercel

# 4. Deploy to production
vercel --prod
```

Answer the prompts (link to your account, accept defaults). Vercel returns a live URL.

### Option B — Import the GitHub repo (dashboard)
1. Push to GitHub (steps above).
2. Go to **https://vercel.com/new**.
3. **Import** your `operation-dhurandar` repository.
4. Framework preset: **Other** (the included `vercel.json` handles the rest).
5. Click **Deploy**. Vercel builds and gives you a production URL; every `git push` auto-deploys.

### ⚙️ Express on Vercel — configuration
`server.js` already exports the app (`module.exports = app`) and only calls `app.listen()` when run
directly, which is exactly what Vercel needs. The included `vercel.json`:

```json
{
  "version": 2,
  "builds": [
    { "src": "server.js", "use": "@vercel/node" },
    { "src": "public/**", "use": "@vercel/static" }
  ],
  "routes": [
    { "src": "/css/(.*)", "dest": "/public/css/$1" },
    { "src": "/js/(.*)", "dest": "/public/js/$1" },
    { "src": "/images/(.*)", "dest": "/public/images/$1" },
    { "src": "/(.*)", "dest": "/server.js" }
  ]
}
```

> ⚠️ **Serverless note:** Vercel's filesystem is **read-only** at runtime, so writes to
> `auth.txt` / `points.json` (adding officers, awarding XP) **won't persist** between requests on
> Vercel. The app is coded to fail gracefully (in-memory updates still work for the session). For
> fully persistent writes in production, move the data layer in `server/store.js` to a database
> (e.g. SQLite, MongoDB Atlas, or Vercel KV/Postgres). **Locally everything persists normally.**
> Don't forget to set `SESSION_SECRET` as a Vercel Environment Variable.

---

## 📜 License

Released under the **MIT License** — free to use, modify, and learn from.

```
MIT License — Copyright (c) 2026 Piyush
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction... (standard MIT terms apply).
```

---

<div align="center">

**`SYSTEM ONLINE · ENCRYPTED CHANNEL · CLEARANCE VERIFIED`**

⚠️ *Fictional entertainment project. No real military data, logos, or branding.*

</div>
