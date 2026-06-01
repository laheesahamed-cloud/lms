# Full online backup v1

Created: 2026-06-01 08:28 +03

This backup includes the current LMS project files, including ignored/generated project files such as `node_modules`, `frontend/node_modules`, `backend/node_modules`, `frontend/dist`, uploads, and videos.

Excluded from the archive:

- `.git`
- `backups`

The archive is split into 50 MB parts for online storage.

To restore:

```sh
cat lms-full-backup-v1.tar.gz.part-* > lms-full-backup-v1.tar.gz
shasum -a 256 lms-full-backup-v1.tar.gz
tar -xzf lms-full-backup-v1.tar.gz
```

Expected SHA-256:

```text
6436c33edc4d581606ae350957743862abec815714bee2903330302ab3d97c2b
```
