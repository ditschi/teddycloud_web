## Cursor Cloud specific instructions

- Für die Non-Docker Dev-Sandbox im Hauptrepo `teddycloud-main` die dokumentierten Befehle aus `dev-sandbox/README.md` verwenden: `make dev-sandbox-setup` und `make dev-sandbox-up`.
- `make dev-sandbox-up` entscheidet automatisch zwischen Docker und nativem Start. Ohne Docker startet es `dev-sandbox/start-native.sh` und verwendet `dev-sandbox/run/` als `--base_path`.
- In Cloud-VMs kann `cc` auf `clang` zeigen; für reproduzierbare Sandbox-Builds `CC=gcc` setzen (sonst können GCC-spezifische Warn-Flags den Build abbrechen).
- Der Web-Build in `make dev-sandbox-up` benötigt ein aktuelles Node (Vite >= 20.19). Vor Sandbox-Start sicherstellen, dass `node --version` die Mindestversion erfüllt.
- Für einen schnellen E2E-Healthcheck gegen die laufende Sandbox `TEDDYCLOUD_BASE_URL=http://127.0.0.1 python3 tests/test_tonies_custom_json_api.py` im `teddycloud-main` Repo ausführen.
