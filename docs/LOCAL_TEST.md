# Combined local test branch

`feature/local-test` contains both features so you can run one sandbox and click through everything. No upstream PRs are opened from here.

## Repos

- Web: `ditschi/teddycloud_web` branch `feature/local-test` (this repo)
- Backend: `ditschi/teddycloud` branch `feature/local-test`

Feature-only branches (same suffix-free names):

- `feature/taf-track-download`
- `feature/web-ui-auth`

## Start

Backend (already built as `bin/teddycloud`):

```bash
cd teddycloud
git checkout feature/local-test
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

## What to try

- Library → `audio_multi.taf` download icon: header checkbox selects all tracks; one track downloads as `.ogg`, more than one as `.zip`; “Download as one file” stays available.
- Settings → Web login: create users, enable login, log in; change a password with the key icon next to the username (no extra section); deleting the last user confirms and turns auth off.
- Lockout recovery (host/container only): `TEDDYCLOUD_WEB_AUTH_DISABLE=1` and restart, or `frontend.web_auth_enabled=false` in `config.ini` and restart.
