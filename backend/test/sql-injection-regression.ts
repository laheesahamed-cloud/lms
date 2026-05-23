import { strict as assert } from 'node:assert';
import { allowedSqlFragment, sqlIdentifier, sqlPlaceholders } from '../src/database/sql-safety';

const payloads = [
  'users; DROP TABLE users; --',
  'users WHERE 1=1',
  'users` UNION SELECT password FROM users --',
  'users/*comment*/',
  'users.id DESC',
];

for (const payload of payloads) {
  assert.throws(() => sqlIdentifier(payload, ['users']), /not allowed|invalid/);
  assert.throws(() => allowedSqlFragment(payload, ['u.id']), /not allowed/);
}

assert.equal(sqlIdentifier('users', ['users']), '`users`');
assert.equal(sqlIdentifier('users.id'), '`users`.`id`');
assert.equal(
  allowedSqlFragment('COALESCE(qa.submitted_at, qa.created_at)', ['COALESCE(qa.submitted_at, qa.created_at)']),
  'COALESCE(qa.submitted_at, qa.created_at)'
);

const maliciousIds = ['1) OR 1=1 --', '2; DROP TABLE questions; --'];
const placeholders = sqlPlaceholders(maliciousIds);
assert.equal(placeholders, '?,?');
assert(!placeholders.includes('DROP TABLE'));
assert(!placeholders.includes('OR 1=1'));

console.log('SQL injection regression checks passed.');
