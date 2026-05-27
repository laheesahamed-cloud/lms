# Full online backup 20260527-1946

This backup includes ignored project files such as `node_modules`, `frontend/node_modules`, `backend/node_modules`, and `frontend/dist`.

The archive was split into 50 MB parts so it can be stored on GitHub.

To restore:

```sh
cat lms-full-backup-20260527-1946.tar.gz.part-* > lms-full-backup-20260527-1946.tar.gz
shasum -a 256 lms-full-backup-20260527-1946.tar.gz
tar -xzf lms-full-backup-20260527-1946.tar.gz
```

Expected SHA-256:

```text
7d4a29b3e2a1799dda118e44afdcccef05ef7b2320bbafc509134c824604901c
```

Only Git internals (`.git`) were excluded from the archive because this backup itself is stored in Git.
