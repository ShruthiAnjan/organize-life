# Organize Life Co. — plan · organize · life

Organize Life Co. is a calm, all-in-one personal life planner: daily priorities, a Jira-style planner, finances (budgets, loans, bills, savings), career tracking, learning, meals, wellness, habits, goals, hobbies and a vision board — in one place.

**Open it:** https://shruthianjan.github.io/Rua/

## Install it as an app (works offline)

**Windows / Mac (Chrome or Edge)**
1. Open the link above.
2. Click the **Install** icon at the right of the address bar, or **Settings → Install as an app**.
   (Or browser menu ⋮ → *Cast, save and share* → *Install page as app* / *Apps → Install this site as an app*.)
3. The app gets its own window and a desktop / Start-menu icon. It opens and works with no internet.

**iPhone / iPad (Safari):** Share → *Add to Home Screen*.
**Android (Chrome):** menu ⋮ → *Install app* / *Add to Home screen*.

## Where your data lives

- Everything you enter is saved **on your device**, inside the browser that installed the app (IndexedDB). Nothing is sent to a server, and this repository never contains your data.
- App updates replace the code only — your tasks, money, journal and photos are kept.
- Uninstalling the app *and* clearing the site's data would erase it, so use **Settings → Export full backup (with photos)** now and then. Keep the file somewhere safe (e.g. OneDrive/Google Drive).
- Each device keeps its own copy. To move data between devices (or from the claude.ai version), export a backup on one and **Restore from backup** on the other.

## How updates work

1. Ask Claude for a change. Claude edits the code here and pushes it to `main`.
2. GitHub Pages republishes the site within a minute or two.
3. Next time you open the app with internet, it downloads the new version and shows **"A new version of Organize Life Co. is ready — Update now"**. Click it (or just reopen the app).

Releases are versioned in `sw.js` (`VERSION`) — bump it with every change so installed apps pick it up.

## Project layout

```
index.html            app shell
manifest.webmanifest  install info (name, icons, colours)
sw.js                 offline support (network-first, cached fallback)
css/app.css           design system
css/fonts.css         self-hosted fonts (Inter, Source Serif 4 — SIL OFL)
js/core.js            storage, dates, UI kit, router
js/charts.js          SVG charts
js/p-*.js             one file per section (home, planner, finance, career, learning, life, goals, vision, reports)
js/boot.js            start-up, offline + install handling
icons/                app icons
```

No build step — plain HTML/CSS/JS. To run locally: `python3 -m http.server` in this folder and open http://localhost:8000.
