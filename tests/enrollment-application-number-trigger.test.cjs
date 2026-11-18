const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/20261119001000_fix_enrollment_application_number_ambiguous_day.sql"),
  "utf8"
);

test("date counter trigger has no column/variable ambiguity", () => {
  assert.match(source, /create or replace function public\.set_enrollment_application_number\(\)/i);
  assert.match(source, /v_reception_day date;/);
  assert.doesNotMatch(source, /\bdeclare\s+reception_day\s+date\b/i);
  assert.match(source, /on conflict on constraint enrollment_request_daily_sequences_pkey/i);
  assert.doesNotMatch(source, /on conflict\s*\(reception_day\)/i);
});

test("application numbers are KST-dated, unique and preserve source IDs", () => {
  assert.match(source, /at time zone 'Asia\/Seoul'/);
  assert.match(source, /v_next_sequence/);
  assert.match(source, /lpad\(v_next_sequence::text, greatest\(3, length\(v_next_sequence::text\)\), '0'\)/);
  assert.match(source, /new\.application_number\s*:=/);
  assert.match(source, /return new;/);
  assert.doesNotMatch(source, /drop table|truncate|delete from public\.enrollment_requests/i);
});
