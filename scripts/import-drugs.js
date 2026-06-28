const XLSX   = require('xlsx');
const mysql  = require('mysql2/promise');
const path   = require('path');

async function main() {
  const wb   = XLSX.readFile(path.join(__dirname, 'drugs.xlsx'));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['drugs']);
  console.log(`Importing ${rows.length} drugs…`);

  const db = await mysql.createPool({
    host: 'localhost', user: 'root', password: '', database: 'lms_db',
    waitForConnections: true, connectionLimit: 5,
  });

  let ok = 0, skip = 0;
  for (const r of rows) {
    if (!r.name) { skip++; continue; }
    try {
      await db.execute(
        `INSERT IGNORE INTO drugs
           (name,drug_class,uses,dosage_adult,dosage_pediatric,
            side_effects,warnings,drug_interactions,pregnancy_info,sl_brand_names)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [r.name||null, r.drug_class||null, r.uses||null,
         r.dosage_adult||null, r.dosage_pediatric||null,
         r.side_effects||null, r.warnings||null,
         r.drug_interactions||null, r.pregnancy_info||null,
         r.sl_brand_names||null],
      );
      ok++;
    } catch (e) { console.error(`  skip ${r.name}: ${e.message}`); skip++; }
  }

  await db.end();
  console.log(`✅  Imported ${ok} drugs (${skip} skipped).`);
}

main().catch(e => { console.error(e); process.exit(1); });
