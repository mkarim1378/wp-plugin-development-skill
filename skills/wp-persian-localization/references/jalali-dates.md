# Jalali (Shamsi) dates

## Rule: store Gregorian/UTC, display Jalali

WordPress core has no Jalali calendar. Post dates, `current_time()`, cron, WooCommerce orders, and REST all use Gregorian. Keep it that way in storage and convert at the edges.

## Display

```php
use Acme\Persian\Persian;

echo esc_html( Persian::format_jalali( $timestamp, 'j F Y', wp_timezone(), true ) ); // ۵ فروردین ۱۴۰۴
echo esc_html( Persian::format_jalali( $timestamp, 'Y/m/d H:i', wp_timezone() ) ); // 1404/01/05 14:30
```

- Always pass `wp_timezone()` (Asia/Tehran for Iranian sites; Iran has had no DST since 2022). Converting in UTC shifts dates near midnight.
- Supported tokens: `Y m n d j F H i s`; escape literal letters with `\\`.
- If the `intl` extension is available and you need weekday names or full locale formats, `IntlDateFormatter` works too:

```php
$fmt = new IntlDateFormatter( 'fa_IR@calendar=persian', IntlDateFormatter::FULL, IntlDateFormatter::NONE, wp_timezone_string(), IntlDateFormatter::TRADITIONAL );
echo esc_html( $fmt->format( $timestamp ) ); // e.g. «چهارشنبه ۵ فروردین ۱۴۰۴»
```

Don't require `intl`; many Iranian hosts don't enable it.

- In JavaScript, browsers support the Persian calendar natively: `new Intl.DateTimeFormat( 'fa-IR-u-ca-persian', { dateStyle: 'long' } ).format( date )`.

## Respect existing date plugins

Sites often run a plugin that filters `date_i18n`/`wp_date` to output Jalali (Parsi date plugins). If you call `wp_date()` on such a site you already get Jalali; converting again breaks it. Options:

- Use `wp_date()` for core-like dates and let the site's date plugin decide, or
- Use the helper explicitly (for UI you control) and document that it always shows Jalali, or
- Add a setting "Calendar: Jalali / Gregorian / Follow site".

## Parsing user input

```php
$raw   = Persian::to_latin_digits( sanitize_text_field( wp_unslash( $_POST['delivery_date'] ?? '' ) ) );
if ( preg_match( '#^(1[34]\d{2})/(\d{1,2})/(\d{1,2})$#', $raw, $m ) ) {
	list( $gy, $gm, $gd ) = Persian::jalali_to_gregorian( (int) $m[1], (int) $m[2], (int) $m[3] );
	if ( checkdate( $gm, $gd, $gy ) ) {
		$date = new DateTimeImmutable( sprintf( '%04d-%02d-%02d 00:00:00', $gy, $gm, $gd ), wp_timezone() );
		update_post_meta( $post_id, '_acme_delivery', $date->getTimestamp() );
	}
}
```

- Validate the Jalali month/day ranges (months 1–6 have 31 days, 7–11 have 30, Esfand 29 or 30). A round trip (`gregorian_to_jalali( jalali_to_gregorian(...) )`) equal to the input proves the date is valid.
- Date pickers: use a Jalali-capable picker or the browser's native input with conversion; submit ISO (`Y-m-d`) in a hidden field so the server never parses localized strings.

## Week and calendar settings

- The Iranian week starts on Saturday: `start_of_week` = 6.
- Friday is the weekend; delivery/booking logic should use the site's configured days, not hard-coded Sat/Sun.
