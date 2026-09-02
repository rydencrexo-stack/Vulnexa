# Vulnexa Live — PAN mobile app

Standalone installable mobile PWA companion for PAN. Vanilla HTML/CSS/JS — no build step, no dependencies.

## Run

```powershell
node server.js        # or: npm start
```

| Port | Purpose |
|---|---|
| `4000` | App over HTTP (`http://localhost:4000`) |
| `4443` | App over HTTPS (`https://localhost:4443`, self-signed demo certs in `../mobile-certs`) |

`server.js` serves the app and proxies every `/api/*` request to the PAN backend (`127.0.0.1:8000`), so the mobile dashboard shows the same live workspace data as the web UI.

## Sign in

Development-only demo credentials (hard-coded in `app.js`):

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin` |

## Data sources

- `POST /api/mobile/data` — consolidated workspace snapshot (targets, scans, assets, findings, reports, workers, activity)
- `POST /api/mobile/chat` — token-protected analyst chat (`MOBILE_TOKEN` in `backend/.env`)

If the backend is unreachable the app falls back to embedded demo data.

## Install as an app

On a phone: open `http://<host-ip>:4000`, sign in, then use the browser menu (or the in-app install button) → "Add to Home Screen". The service worker (`sw.js`) caches the shell for offline startup.

## Files

| File | Purpose |
|---|---|
| `index.html` | Login screen + app shell (sidebar, top bar, bottom nav) |
| `app.js` | Views, live-data loading, navigation, install/logout |
| `styles.css` | Mobile-first dark theme |
| `server.js` | Static server + `/api` reverse proxy |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA installability + offline shell |