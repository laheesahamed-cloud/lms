/**
 * Regression tests for Apple IAP signature verification.
 *
 * Run: npx ts-node --project tsconfig.test.json -T test/apple-iap-regression.ts
 *
 * Covers both directions, which matters: a service that rejected *everything*
 * would pass the adversarial half alone. The acceptance half is what caught the
 * original `createPublicKey(cert.publicKey)` bug that would have made every real
 * Apple transaction fail.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, createPrivateKey, createSign } from 'node:crypto';
import { AppleIapService } from '../src/modules/subscriptions/apple-iap.service';

const dir = mkdtempSync(join(tmpdir(), 'apple-iap-test-'));
const sh = (cmd: string) => execSync(cmd, { cwd: dir, stdio: 'pipe' }).toString();

// A CA we control, standing in for an attacker (adversarial half) and, via the
// subclass below, for Apple (acceptance half).
sh('openssl ecparam -name prime256v1 -genkey -noout -out root.key');
sh('openssl req -x509 -new -key root.key -sha256 -days 3650 -out root.pem -subj "/CN=Test Root CA"');
sh('openssl ecparam -name prime256v1 -genkey -noout -out leaf.key');
sh('openssl req -new -key leaf.key -out leaf.csr -subj "/CN=Test Leaf"');
sh('openssl x509 -req -in leaf.csr -CA root.pem -CAkey root.key -CAcreateserial -sha256 -days 365 -out leaf.pem');

const rootPem = readFileSync(join(dir, 'root.pem'), 'utf8').trim();
const rootFingerprint = createHash('sha256')
  .update(
    Buffer.from(rootPem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, ''), 'base64')
  )
  .digest('hex');

/** Same verifier, with the single trust anchor swapped to our test root. */
class TestAnchoredAppleIapService extends AppleIapService {
  protected trustAnchor() {
    return { pem: rootPem, fingerprint: rootFingerprint };
  }
}

const b64url = (value: Buffer | string) =>
  Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const derOf = (file: string) =>
  readFileSync(join(dir, file), 'utf8').replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '');

const x5c = [derOf('leaf.pem'), derOf('root.pem')];

function sign(header: object, body: object): string {
  const encodedHeader = b64url(JSON.stringify(header));
  const encodedBody = b64url(JSON.stringify(body));
  const signer = createSign('SHA256');
  signer.update(`${encodedHeader}.${encodedBody}`);
  signer.end();

  // Node signs to DER; Apple sends the raw r||s JOSE form, so convert.
  const der = signer.sign(createPrivateKey(readFileSync(join(dir, 'leaf.key'), 'utf8')));
  let cursor = 2;
  if (der[1] & 0x80) cursor += der[1] & 0x7f;
  const rLength = der[cursor + 1];
  const r = der.subarray(cursor + 2, cursor + 2 + rLength);
  const sLength = der[cursor + 2 + rLength + 1];
  const s = der.subarray(cursor + 2 + rLength + 2, cursor + 2 + rLength + 2 + sLength);
  const pad = (value: Buffer) =>
    value.length >= 32 ? value.subarray(value.length - 32) : Buffer.concat([Buffer.alloc(32 - value.length), value]);

  return `${encodedHeader}.${encodedBody}.${b64url(Buffer.concat([pad(r), pad(s)]))}`;
}

const expiresDate = Date.now() + 30 * 86_400_000;
const transactionPayload = {
  transactionId: '2000000000000001',
  originalTransactionId: '1000000000000009',
  productId: 'app.xyndrome.lk.monthly',
  bundleId: 'app.xyndrome.lk',
  environment: 'Sandbox',
  purchaseDate: Date.now(),
  expiresDate,
  type: 'Auto-Renewable Subscription',
};

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name} ${detail}`);
  }
}
function rejects(name: string, run: () => unknown) {
  try {
    run();
    check(name, false, '(accepted, expected rejection)');
  } catch {
    check(name, true);
  }
}

process.env.APPLE_IAP_ALLOW_SANDBOX = '1';
process.env.NODE_ENV = 'test';

// ── Adversarial: real Apple pin in place, so our chain must be refused ──
const production = new AppleIapService();
console.log('\nApple IAP — forgery resistance (pinned to Apple Root CA - G3)\n');

rejects('chain signed by a foreign root is rejected', () =>
  production.verifyTransaction(sign({ alg: 'ES256', x5c }, transactionPayload))
);
rejects('alg=none is rejected', () =>
  production.verifyTransaction(
    `${b64url(JSON.stringify({ alg: 'none', x5c }))}.${b64url(JSON.stringify(transactionPayload))}.`
  )
);
rejects('missing x5c chain is rejected', () =>
  production.verifyTransaction(sign({ alg: 'ES256' }, transactionPayload))
);
rejects('single-certificate chain is rejected', () =>
  production.verifyTransaction(sign({ alg: 'ES256', x5c: [derOf('leaf.pem')] }, transactionPayload))
);
rejects('malformed token is rejected', () => production.verifyTransaction('not.a.jws'));
rejects('empty token is rejected', () => production.verifyTransaction(''));

// ── Acceptance: anchor swapped to our root, so a well-formed JWS must pass ──
const service = new TestAnchoredAppleIapService();
console.log('\nApple IAP — acceptance and claim parsing (anchor swapped to test root)\n');

const transaction = service.verifyTransaction(sign({ alg: 'ES256', x5c }, transactionPayload));
check('valid JWS is accepted', !!transaction);
check('transactionId parsed', transaction.transactionId === '2000000000000001', transaction.transactionId);
check(
  'originalTransactionId parsed',
  transaction.originalTransactionId === '1000000000000009',
  transaction.originalTransactionId
);
check('productId parsed', transaction.productId === 'app.xyndrome.lk.monthly', transaction.productId);
check('environment parsed', transaction.environment === 'Sandbox', transaction.environment);
check('expiresDate parsed', transaction.expiresDate === expiresDate, String(transaction.expiresDate));
check('revocationDate is null when absent', transaction.revocationDate === null);

rejects('tampered payload is rejected', () => {
  const [header, , signature] = sign({ alg: 'ES256', x5c }, transactionPayload).split('.');
  const swapped = b64url(JSON.stringify({ ...transactionPayload, productId: 'app.xyndrome.lk.yearly' }));
  return service.verifyTransaction(`${header}.${swapped}.${signature}`);
});
rejects('foreign bundleId is rejected', () =>
  service.verifyTransaction(sign({ alg: 'ES256', x5c }, { ...transactionPayload, bundleId: 'com.evil.app' }))
);

// ── Environment gating ──
process.env.APPLE_IAP_ALLOW_SANDBOX = '0';
process.env.NODE_ENV = 'production';
const strict = new TestAnchoredAppleIapService();
rejects('Sandbox transaction is rejected in production', () =>
  strict.verifyTransaction(sign({ alg: 'ES256', x5c }, transactionPayload))
);
check(
  'Production transaction is accepted in production',
  strict.verifyTransaction(sign({ alg: 'ES256', x5c }, { ...transactionPayload, environment: 'Production' }))
    .environment === 'Production'
);

// ── Notification envelope ──
const notification = strict.verifyNotification(
  sign(
    { alg: 'ES256', x5c },
    {
      notificationType: 'DID_RENEW',
      subtype: '',
      notificationUUID: 'uuid-1',
      data: {
        bundleId: 'app.xyndrome.lk',
        environment: 'Production',
        signedTransactionInfo: 'inner.jws.here',
      },
    }
  )
);
check(
  'server notification is parsed',
  notification.notificationType === 'DID_RENEW' && notification.signedTransactionInfo === 'inner.jws.here'
);

// ── Entitlement logic ──
const base = { revocationDate: null, expiresDate: null } as any;
check('entitled when non-expiring', strict.isEntitled({ ...base }));
check('entitled while unexpired', strict.isEntitled({ ...base, expiresDate: Date.now() + 60_000 }));
check('not entitled once expired', !strict.isEntitled({ ...base, expiresDate: Date.now() - 60_000 }));
check(
  'not entitled once revoked',
  !strict.isEntitled({ ...base, expiresDate: Date.now() + 9_000_000, revocationDate: Date.now() })
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
