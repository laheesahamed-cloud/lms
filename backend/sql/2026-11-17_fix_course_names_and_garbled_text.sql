-- 2026-11-17 — data fixes found in the Flutter pre-submission test.
--   1. Course names: "Gynacology" -> "Gynaecology", "Peadiatrics" -> "Paediatrics".
--   2. Double-encoded characters in questions (UTF-8 text stored twice-encoded):
--        â€” -> —   â€“ -> –   Â° -> °   Ã— -> ×   Ã© -> é
--      Local count before: explanation 48, options_json 38, question_text 7,
--      recap_json 2, question_approach 1 rows.
--
-- Guarded: every UPDATE only touches rows that still contain the wrong text,
-- so running it twice changes nothing. Run inside one transaction; check the
-- counts printed at the end before COMMIT (the file ends with COMMIT).
-- Byte sequences are written as hex so the file itself can't be mis-encoded.
-- After running: bump content_version (+1 in system_settings) and RESTART the
-- backend — the catalogue and version are kept in server memory.

SET NAMES utf8mb4;
START TRANSACTION;

-- 1. Course names (exact match only)
UPDATE courses SET course_title = 'Gynaecology and Obstetrics'
 WHERE course_title = 'Gynacology and Obstetrics';
UPDATE courses SET course_title = 'Paediatrics'
 WHERE course_title = 'Peadiatrics';

-- 2a. Raise the content stamp of every set holding a question about to be
--     fixed, so phones re-download those sets (their saved copies are kept
--     until the stamp changes). Must run BEFORE the REPLACE below.
UPDATE quizzes SET content_stamp = content_stamp + 1
 WHERE id IN (SELECT qq.quiz_id FROM question_quizzes qq JOIN questions q ON q.id = qq.question_id
               WHERE CONCAT_WS('', q.explanation, q.options_json, q.question_text, q.recap_json, q.question_approach)
                     REGEXP CONCAT(UNHEX('C3A2C280'), '|', UNHEX('C382C2B0'), '|', UNHEX('C383C297'), '|', UNHEX('C383C2A9')));

-- 2. Garbled characters. Hex: C3A2C280C294 = "â€”" (em dash), C3A2C280C293 = "â€“"
--    (en dash), C382C2B0 = "Â°", C383C297 = "Ã—", C383C2A9 = "Ã©".
--    Replacements: E28094 = —, E28093 = –, C2B0 = °, C397 = ×, C3A9 = é.
UPDATE questions SET
  explanation       = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(explanation,
                        UNHEX('C3A2C280C294'), UNHEX('E28094')), UNHEX('C3A2C280C293'), UNHEX('E28093')),
                        UNHEX('C382C2B0'), UNHEX('C2B0')), UNHEX('C383C297'), UNHEX('C397')), UNHEX('C383C2A9'), UNHEX('C3A9')),
  options_json      = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(options_json,
                        UNHEX('C3A2C280C294'), UNHEX('E28094')), UNHEX('C3A2C280C293'), UNHEX('E28093')),
                        UNHEX('C382C2B0'), UNHEX('C2B0')), UNHEX('C383C297'), UNHEX('C397')), UNHEX('C383C2A9'), UNHEX('C3A9')),
  question_text     = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(question_text,
                        UNHEX('C3A2C280C294'), UNHEX('E28094')), UNHEX('C3A2C280C293'), UNHEX('E28093')),
                        UNHEX('C382C2B0'), UNHEX('C2B0')), UNHEX('C383C297'), UNHEX('C397')), UNHEX('C383C2A9'), UNHEX('C3A9')),
  recap_json        = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(recap_json,
                        UNHEX('C3A2C280C294'), UNHEX('E28094')), UNHEX('C3A2C280C293'), UNHEX('E28093')),
                        UNHEX('C382C2B0'), UNHEX('C2B0')), UNHEX('C383C297'), UNHEX('C397')), UNHEX('C383C2A9'), UNHEX('C3A9')),
  question_approach = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(question_approach,
                        UNHEX('C3A2C280C294'), UNHEX('E28094')), UNHEX('C3A2C280C293'), UNHEX('E28093')),
                        UNHEX('C382C2B0'), UNHEX('C2B0')), UNHEX('C383C297'), UNHEX('C397')), UNHEX('C383C2A9'), UNHEX('C3A9'))
WHERE CONCAT_WS('', explanation, options_json, question_text, recap_json, question_approach)
      REGEXP CONCAT(UNHEX('C3A2C280'), '|', UNHEX('C382C2B0'), '|', UNHEX('C383C297'), '|', UNHEX('C383C2A9'));

-- Check: all of these should be 0, and options_json must still be valid JSON.
SELECT
  (SELECT COUNT(*) FROM courses WHERE course_title IN ('Gynacology and Obstetrics', 'Peadiatrics')) AS old_course_names,
  (SELECT COUNT(*) FROM questions WHERE HEX(CONCAT_WS('', explanation, options_json, question_text, recap_json, question_approach))
      REGEXP 'C3A2C280|C382C2B0|C383C297|C383C2A9') AS garbled_left,
  (SELECT COUNT(*) FROM questions WHERE options_json IS NOT NULL AND JSON_VALID(options_json) = 0) AS bad_options_json,
  (SELECT COUNT(*) FROM questions WHERE recap_json IS NOT NULL AND recap_json <> '' AND JSON_VALID(recap_json) = 0) AS bad_recap_json;

COMMIT;
