# Digits and Persian text

## Three digit sets

| Set | Digits | Unicode |
| --- | --- | --- |
| ASCII | 0–9 | U+0030–0039 |
| Persian (Extended Arabic-Indic) | ۰۱۲۳۴۵۶۷۸۹ | U+06F0–06F9 |
| Arabic-Indic | ٠١٢٣٤٥٦٧٨٩ | U+0660–0669 |

Persian keyboards produce Persian digits; some Android keyboards produce Arabic-Indic digits. `is_numeric()`, `ctype_digit()`, `absint()`, `(int)`, and regex `\d` (without the `u` flag) only understand ASCII, so `absint( '۱۲' )` is `0`.

Rules:

- Convert to ASCII **before** sanitizing numbers: `absint( Persian::to_latin_digits( wp_unslash( $_POST['qty'] ) ) )`.
- Apply it to phone numbers, codes, quantities, prices, dates, OTPs, and card/Sheba numbers.
- Store ASCII. Convert to Persian digits only when printing (`Persian::to_persian_digits()`), and never inside values used by JS, URLs, or attributes that code reads back.
- In JS: `value.replace( /[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf( d ) ).replace( /[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf( d ) )`, or format with `new Intl.NumberFormat( 'fa-IR' )` for display.
- `number_format_i18n()` uses the locale's separators but keeps ASCII digits; wrap with `to_persian_digits()` if you want Persian digits.

## Arabic vs Persian letters

Arabic keyboards and copy-pasted text produce `ي` (U+064A) and `ك` (U+0643); Persian uses `ی` (U+06CC) and `ک` (U+06A9). They look identical but don't match in search or uniqueness checks.

- Normalize search terms and lookup keys with `Persian::normalize_text()`; for searchable content, store a normalized copy (meta or a lookup column) rather than rewriting the user's text.
- Usernames/slugs: normalize before uniqueness checks.

## Half-space (ZWNJ)

Persian uses the zero-width non-joiner (U+200C, «نیم‌فاصله») inside words (می‌شود). Don't strip it in sanitization of display text; `sanitize_text_field()` keeps it. When generating slugs, WordPress converts it like other characters; test slugs with Persian titles.

## Sorting and comparison

- Use `Collator` (intl) with `fa_IR` for correct alphabetical order when available; otherwise sort normalized strings with `strcmp()` as a fallback and accept imperfect order.
- `strtolower()`/`ucfirst()` are no-ops or break multibyte text; use `mb_*` functions with `UTF-8`.

## Database

Make sure custom tables use `$wpdb->get_charset_collate()` (utf8mb4). Hard-coded `latin1`/`utf8` tables corrupt Persian text and emoji.
