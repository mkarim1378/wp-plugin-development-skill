import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const helper = path.join(here, "..", "skills", "wp-persian-localization", "assets", "class-persian.php").replace(/\\/g, "/");
const hasPhp = spawnSync("php", ["-v"], { encoding: "utf8" }).status === 0;

// Runs PHP code with the helper loaded and returns the JSON it prints.
function php(code, input = "") {
  const script = `define('PERSIAN_HELPERS_TESTING', true); require '${helper}'; use Acme\\Persian\\Persian; ${code}`;
  const out = spawnSync("php", ["-r", script], { encoding: "utf8", input, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(out.status, 0, out.stderr || out.stdout);
  return JSON.parse(out.stdout);
}

// Reference Jalali date from ICU (Node's Intl Persian calendar).
const intl = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
function icuJalali(date) {
  const parts = Object.fromEntries(intl.formatToParts(date).map((p) => [p.type, p.value]));
  return [Number.parseInt(parts.year, 10), Number(parts.month), Number(parts.day)];
}

test("digits and text normalization", { skip: !hasPhp }, () => {
  const r = php(`echo json_encode([
    Persian::to_latin_digits('۰۹۱۲-٣٤٥'),
    Persian::to_persian_digits('1404/01/05'),
    Persian::normalize_text(' علي كريمي ۱۲ '),
  ]);`);
  assert.deepEqual(r, ["0912-345", "۱۴۰۴/۰۱/۰۵", "علی کریمی 12"]);
});

test("mobile numbers", { skip: !hasPhp }, () => {
  const r = php(`echo json_encode(array_map([Persian::class, 'normalize_mobile'], ['+98 912 345 6789', '00989123456789', '۰۹۱۲۳۴۵۶۷۸۹', '9123456789', '0812345678', '091234']));`);
  assert.deepEqual(r, ["09123456789", "09123456789", "09123456789", "09123456789", "", ""]);
});

test("national code, postal code, sheba", { skip: !hasPhp }, () => {
  const r = php(`echo json_encode([
    Persian::is_valid_national_code('0499370899'),
    Persian::is_valid_national_code('۰۴۹۹۳۷۰۸۹۹'),
    Persian::is_valid_national_code('0499370898'),
    Persian::is_valid_national_code('1111111111'),
    Persian::is_valid_postal_code('13185-17866'),
    Persian::is_valid_postal_code('12345'),
    Persian::is_valid_sheba('IR062960000000100324200001'),
    Persian::is_valid_sheba('IR062960000000100324200002'),
    Persian::toman_to_rial('۱۲۵۰۰'),
  ]);`);
  assert.deepEqual(r, [true, true, false, false, true, false, true, false, 125000]);
});

test("gregorian_to_jalali matches ICU and round-trips, 1950-2100", { skip: !hasPhp }, () => {
  const dates = [];
  for (let t = Date.UTC(1950, 0, 1); t <= Date.UTC(2100, 11, 31); t += 3 * 86400000) {
    const d = new Date(t);
    dates.push([d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]);
  }
  const results = php(
    `$in = json_decode(file_get_contents('php://stdin'), true);
    $out = [];
    foreach ($in as $g) {
      $j = Persian::gregorian_to_jalali($g[0], $g[1], $g[2]);
      $out[] = [$j, Persian::jalali_to_gregorian($j[0], $j[1], $j[2])];
    }
    echo json_encode($out);`,
    JSON.stringify(dates)
  );

  let mismatches = 0;
  results.forEach(([jalali, back], i) => {
    const g = dates[i];
    assert.deepEqual(back, g, `round trip failed for ${g}`);
    const ref = icuJalali(new Date(Date.UTC(g[0], g[1] - 1, g[2])));
    if (jalali.join() !== ref.join()) mismatches += 1;
  });
  assert.equal(mismatches, 0, `${mismatches} dates differ from ICU`);
});

test("format_jalali", { skip: !hasPhp }, () => {
  // 2025-03-21 00:00 Tehran = 1404/01/01 (Nowruz).
  const r = php(`$tz = new DateTimeZone('Asia/Tehran'); $ts = (new DateTimeImmutable('2025-03-21 08:30:00', $tz))->getTimestamp();
    echo json_encode([Persian::format_jalali($ts, 'Y/m/d H:i', $tz), Persian::format_jalali($ts, 'j F Y', $tz, true), Persian::format_jalali($ts, '\\\\Y Y', $tz)]);`);
  assert.deepEqual(r, ["1404/01/01 08:30", "۱ فروردین ۱۴۰۴", "Y 1404"]);
});
