// OPTIMIZE 10.38 → 10.39: content_versions and content_workflow_states were
// dropped (never read). Kept as a no-op so the delete paths stay unchanged.
import { Pool, PoolConnection } from 'mysql2/promise';

export async function forgetContentHistory(_db: Pool | PoolConnection, _entityType: string, _ids: number[]) {
  // nothing stored any more
}
