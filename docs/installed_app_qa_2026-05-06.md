# Installed App QA

Date: 2026-05-06
Build: 0.1.0

## Installed App

- Install directory: `C:\Users\awake\AppData\Local\Distill`
- Executable: `C:\Users\awake\AppData\Local\Distill\app.exe`
- Start menu shortcut: `C:\Users\awake\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Distill.lnk`
- Running process verified: `app.exe`

## Data Store

- SQLite store: `C:\Users\awake\AppData\Roaming\app.distill.local\distill.sqlite3`
- Automatic latest backup: `C:\Users\awake\AppData\Roaming\app.distill.local\backups\distill-auto-backup-latest.json`

## Store Counts

- Projects: 3
- Blocks: 4
- Tags: 7
- Links: 7
- People: 1
- Concepts: 7
- Graph edges: 11
- Full JSON snapshots: 1

## Verified User Data

The installed SQLite store and automatic backup both include the captured Japanese block:

```text
明日の会議で [[検索体験]] を確認する @Aki #meeting
```

## Result

The installed app launches, writes SQLite data, maintains normalized indexes, and writes the automatic latest backup.
