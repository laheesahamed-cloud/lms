import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import mysql from 'mysql2/promise';

const rootDir = resolve(import.meta.dirname, '..', '..');
const migrationsDir = resolve(rootDir, 'database', 'migrations');

function envNumber(name, fallback) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) ? value : fallback;
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: envNumber('DB_PORT', 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lms_db',
    multipleStatements: true,
  });

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_schema_migrations_filename (filename)
      )
    `);

    const [appliedRows] = await connection.execute('SELECT filename FROM schema_migrations');
    const applied = new Set(appliedRows.map((row) => String(row.filename)));
    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip ${file}`);
        continue;
      }

      const sql = await readFile(join(migrationsDir, file), 'utf8');
      await connection.query(sql);
      await connection.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
      console.log(`applied ${file}`);
    }

    if (files.length === applied.size) {
      console.log('database migrations are up to date');
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
