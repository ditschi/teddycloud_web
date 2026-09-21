# Combined local test branch

`feature/local-test` contains both web features so you can run one sandbox and click through everything. No upstream PRs are opened from here.

## Repos

- Web: `ditschi/teddycloud_web` branch `feature/local-test` (this repo)
- Backend: `ditschi/teddycloud` branch `feature/web-ui-auth` (login). There is no backend `feature/local-test` yet; TAF track split (`tracks=`) is still web-only, so a multi-track TAF such as Kikaninchen downloads as one OGG until that backend lands.

Feature-only web branches:

- `feature/taf-track-download`
- `feature/web-ui-auth`

## Homeserver: copy Kikaninchen, then a separate test stack

Do **not** point the test container at the production `library`/`config` volumes. Copy one TAF out, keep production on its current image.

On the homeserver (SSH):

```bash
# 1) Copy Kikaninchen out of production (read-only)
cd teddycloud_web   # or wherever this repo lives
chmod +x scripts/import-kikaninchen-from-prod.sh
./scripts/import-kikaninchen-from-prod.sh
# optional: TEDDYCLOUD_CONTAINER=teddycloud DEST=/tmp/kikaninchen.taf ./scripts/import-kikaninchen-from-prod.sh
```

```bash
# 2) Test stack next to production (own data dir, other ports, no box port 443)
cd teddycloud
git fetch origin
git checkout feature/web-ui-auth
./dev-sandbox/setup.sh
cp /path/to/kikaninchen.taf dev-sandbox/run/data/library/kikaninchen.taf
cd dev-sandbox
docker compose up --build -d
# Web UI: http://<homeserver>:8080
# Production stays on 80/443/8443
```

Login stays off until you create a user and enable it in that test UI. The Tonieboxes keep talking to production on 443.

## Start (dev machine / native sandbox)

Backend (already built as `bin/teddycloud`):

```bash
cd teddycloud
git checkout feature/web-ui-auth
./dev-sandbox/start-native.sh
# http://127.0.0.1:8080
```

Web:

```bash
cd teddycloud_web
git checkout feature/local-test
npm run start-http
# http://127.0.0.1:3000/web
```

`.env.local` proxies `/api` and `/content` to `http://127.0.0.1:8080`.

Screenshots and demo videos stay local (`docs/pr-screenshots/`, gitignored).

## What to try

- Library → `kikaninchen.taf` (or a sandbox `audio_*.taf`) download icon: header checkbox selects all tracks; one track is meant to download as `.ogg`, more than one as `.zip`. Until the backend `tracks=` patch exists, the server still sends the whole OGG.
- Settings → Web login: create users, enable login, log in; change a password with the pencil icon on the right of the user row; deleting the last user confirms and turns auth off.
- Lockout recovery (host/container only): `TEDDYCLOUD_WEB_AUTH_DISABLE=1` and restart, or `frontend.web_auth_enabled=false` in `config.ini` and restart.
