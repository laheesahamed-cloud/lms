import { strict as assert } from 'node:assert';
import { SubscriptionsService } from '../src/modules/subscriptions/subscriptions.service';

const pad = (n: number) => String(n).padStart(2, '0');
const dateText = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plusDays = (days: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days); return d; };

class FakeDb {
  inserted: any[] = [];
  cancelledOld = false;
  // mysql2 returns DATE columns as JS Date objects — the bug came from treating them as strings.
  constructor(private readonly row: { status: string; end: Date; accessLapsed?: number }) {}
  async execute(sql: string, params: any[] = []): Promise<[any, any]> {
    const q = sql.replace(/\s+/g, ' ').trim();
    if (q.includes('FROM user_subscriptions us') && q.includes('WHERE us.id = ?')) {
      return [[{ id: 7, user_id: 5, plan_id: 22, status: this.row.status, start_date: plusDays(-400), end_date: this.row.end, access_lapsed: this.row.accessLapsed ?? 0 }], []];
    }
    return [{ affectedRows: 1 }, []];
  }
  async getConnection() {
    const db = this;
    return {
      beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
      execute: async (sql: string, params: any[] = []) => {
        const q = sql.replace(/\s+/g, ' ').trim();
        if (q.startsWith('UPDATE user_subscriptions')) db.cancelledOld = true;
        if (q.startsWith('INSERT INTO user_subscriptions')) { db.inserted.push(params); return [{ insertId: 99 }, []]; }
        return [{ affectedRows: 1 }, []];
      },
    };
  }
}

const plan = { id: 22, name: 'Master Prep - 1 Year', slug: 'master-prep-6m', durationDays: 365, effectivePrice: 14990 };
const make = (db: FakeDb) => new SubscriptionsService(db as any, { findById: async () => plan } as any, {} as any, {} as any, {} as any);
const dto = { planId: 22, paymentStatus: 'manual' as const };

async function main() {
  // Still running (ends in 10 days): refused, with a pointer to Extend, and nothing changes.
  const active = new FakeDb({ status: 'active', end: plusDays(10) });
  await assert.rejects(() => make(active).renewSubscription(7, dto, 1), /still active.*Use Extend/);
  assert.equal(active.inserted.length, 0);
  assert.equal(active.cancelledOld, false, 'a refused renewal must not cancel the current subscription');

  // Ends today: it is still active today, so it is refused as well.
  await assert.rejects(() => make(new FakeDb({ status: 'active', end: plusDays(0) })).renewSubscription(7, dto, 1), /Use Extend/);

  // Expired long ago: renews from TODAY, for the plan's full length.
  const expired = new FakeDb({ status: 'expired', end: plusDays(-30) });
  const result = await make(expired).renewSubscription(7, dto, 1);
  assert.equal(result.id, 99);
  const row = expired.inserted[0];
  const start = row[14]; const end = row[15];
  assert.equal(start, dateText(plusDays(0)), 'starts today, not at the old expiry date');
  assert.equal(end, dateText(plusDays(364)), 'ends plan length (365 days, counting today) later');

  // Expired yesterday: still starts today.
  const yesterday = new FakeDb({ status: 'active', end: plusDays(-1) });
  await make(yesterday).renewSubscription(7, dto, 1);
  assert.equal(yesterday.inserted[0][14], dateText(plusDays(0)));

  // A cancelled one can be renewed too.
  const cancelled = new FakeDb({ status: 'cancelled', end: plusDays(-5) });
  await make(cancelled).renewSubscription(7, dto, 1);
  assert.equal(cancelled.inserted[0][14], dateText(plusDays(0)));

  console.log('Subscription renewal checks passed.');
}
main().catch((error) => { console.error(error); process.exit(1); });
