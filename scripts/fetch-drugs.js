/**
 * Standalone drug data fetcher — run ONCE, produces drugs.xlsx for DB import.
 *
 * Usage:
 *   cd scripts
 *   npm install node-fetch@2 xlsx   (one-time; these are NOT app deps)
 *   node fetch-drugs.js
 *
 * Output: scripts/drugs.xlsx  — import the "drugs" sheet into the `drugs` table.
 *
 * Columns produced (match the DB schema exactly):
 *   name | drug_class | uses | dosage_adult | dosage_pediatric |
 *   side_effects | warnings | drug_interactions | pregnancy_info | sl_brand_names
 *
 * Sources:
 *   • OpenFDA drug label API  — https://api.fda.gov/drug/label.json
 *   • RxNorm API              — https://rxnav.nlm.nih.gov/REST
 */

const fetch = require('node-fetch');
const XLSX  = require('xlsx');
const fs    = require('fs');
const path  = require('path');

// ── How many drugs to fetch from OpenFDA ────────────────────────────────────
const TOTAL_LIMIT  = 500;   // total drugs
const BATCH_SIZE   = 100;   // OpenFDA max per request
// ────────────────────────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function first(arr) {
  if (!arr || !arr.length) return null;
  return arr[0].replace(/\n+/g, ' ').trim();
}

function join(arr) {
  if (!arr || !arr.length) return null;
  const s = arr.map(s => s.replace(/\n+/g, ' ').trim()).join('; ');
  return s.length > 5000 ? s.slice(0, 5000) + '…' : s;
}

async function fetchBatch(skip) {
  const url =
    `https://api.fda.gov/drug/label.json` +
    `?limit=${BATCH_SIZE}&skip=${skip}` +
    `&search=openfda.product_type:"HUMAN+PRESCRIPTION+DRUG"`;
  const res = await fetch(url, { timeout: 20000 });
  if (!res.ok) throw new Error(`OpenFDA ${res.status} at skip=${skip}`);
  return res.json();
}

function parseRow(label) {
  const openfda = label.openfda || {};

  const name      = first(openfda.brand_name) || first(openfda.generic_name) || null;
  if (!name) return null;

  const drugClass = first(openfda.pharm_class_epc) || first(openfda.pharm_class_moa) || null;

  return {
    name,
    drug_class:       drugClass,
    uses:             join(label.indications_and_usage),
    dosage_adult:     join(label.dosage_and_administration),
    dosage_pediatric: join(label.pediatric_use),
    side_effects:     join(label.adverse_reactions),
    warnings:         join(label.warnings) || join(label.warnings_and_cautions),
    drug_interactions:join(label.drug_interactions),
    pregnancy_info:   join(label.pregnancy) || join(label.pregnancy_or_breast_feeding),
    sl_brand_names:   '',   // fill in manually for Sri Lanka market
  };
}

async function main() {
  const rows = [];
  const seen = new Set();

  for (let skip = 0; skip < TOTAL_LIMIT; skip += BATCH_SIZE) {
    process.stdout.write(`Fetching ${skip}–${skip + BATCH_SIZE}…`);
    try {
      const data = await fetchBatch(skip);
      const results = data.results || [];
      for (const label of results) {
        const row = parseRow(label);
        if (row && !seen.has(row.name.toLowerCase())) {
          seen.add(row.name.toLowerCase());
          rows.push(row);
        }
      }
      console.log(` → ${rows.length} unique drugs so far`);
    } catch (err) {
      console.error(` ✗ ${err.message} — skipping batch`);
    }
    await sleep(300); // be polite to the public API
  }

  console.log(`\nTotal unique drugs collected: ${rows.length}`);

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      'name','drug_class','uses','dosage_adult','dosage_pediatric',
      'side_effects','warnings','drug_interactions','pregnancy_info','sl_brand_names',
    ],
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'drugs');

  const outPath = path.join(__dirname, 'drugs.xlsx');
  XLSX.writeFile(wb, outPath);
  console.log(`\n✅  Written to ${outPath}`);
  console.log('   → Review & fill "sl_brand_names" column, then import into DB.');
  console.log('   → SQL: LOAD DATA LOCAL INFILE or use phpMyAdmin import (CSV mode).');
}

main().catch(err => { console.error(err); process.exit(1); });
