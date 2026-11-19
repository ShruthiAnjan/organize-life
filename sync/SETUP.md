# Set up sync between your laptop and iPhone (Cloudflare, ~10 minutes, free)

Sync uses a tiny service in **your own Cloudflare account**. Everything is encrypted on your
device with your passphrase before it's sent, so Cloudflare only ever stores scrambled data.

## 1. Create the database
1. Go to **dash.cloudflare.com** and log in.
2. Left menu → **Storage & databases** → **D1 SQL database** → **Create database**.
3. Name it `organize-life-sync` → **Create**. (Leave location on automatic.)

## 2. Create the Worker
1. Left menu → **Compute (Workers)** → **Workers & Pages** → **Create** → **Create Worker**
   (choose **Start with Hello World!** if asked).
2. Name it `organize-life-sync` → **Deploy**.
3. Click **Edit code**. Delete everything in the editor, then paste the full contents of
   [`sync/worker.js`](./worker.js) from this repo (open it → **Copy raw file**).
4. Click **Deploy** (top right).

## 3. Connect the database to the Worker
1. Go back to the Worker's page → **Settings** tab → **Bindings** → **Add binding**.
2. Choose **D1 database**.
3. **Variable name:** `DB` (exactly, capital letters) · **D1 database:** `organize-life-sync` → **Add binding / Deploy**.

## 4. Check it works
Open your Worker address (shown on the Worker page, e.g.
`https://organize-life-sync.<your-name>.workers.dev`). You should see:
`{"ok":true,"app":"organize-life-sync","version":1}`

## 5. Turn on sync in the app
On your **laptop** (installed app):
1. **Settings → Sync between devices**.
2. Paste the Worker address, choose a passphrase (10+ characters, write it down!), type it again.
3. **Connect & sync**. The first device uploads everything (photos may take a minute).

On your **iPhone** (home-screen app): do exactly the same with the **same address and passphrase**.
It downloads everything, and from then on both stay in sync.

## Good to know
- Changes sync a few seconds after you make them, whenever the device is online. Offline changes wait and sync later.
- If the same item is changed on both devices, the most recent change wins.
- The passphrase can't be recovered. If you lose it: in Cloudflare, open the D1 database → **Console** → run
  `DROP TABLE meta; DROP TABLE items; DROP TABLE blobs;` and connect again with a new passphrase
  (each device still keeps its own data, so nothing is lost).
- Free plan limits (5 GB storage, 100,000 writes a day) are far more than a personal planner needs.
- Sync works in the installed app / website only. The claude.ai version keeps its own copy — move it over once with Export backup → Restore.
