---
name: wp-persian-localization
description: "Use when a WordPress plugin targets Persian (fa_IR) users or the Iranian market: Jalali (Shamsi) dates, Persian/Arabic digit normalization, Arabic vs Persian letters, RTL admin and frontend, local Persian fonts, fa_IR translations, Iranian mobile/national code/postal code/Sheba validation, Rial vs Toman, Iranian payment gateways (Zarinpal-style request/verify flows), Iranian SMS providers and OTP, and services that are unreachable from Iran. Pairs with wp-plugin-development and wp-woocommerce-extension."
compatibility: "Targets WordPress 7.0+ (PHP 7.4.0+). Filesystem-based agent with bash + node. Some workflows require WP-CLI."
---

# Persian localization and the Iranian market

## When to use

- The plugin's users write Persian, use Jalali dates, or pay in Rial/Toman.
- Forms take Iranian phone numbers, national codes, postal codes, or Sheba (IBAN) numbers.
- Integrating an Iranian payment gateway or SMS provider.
- RTL layout bugs, mixed-digit input bugs, or "doesn't load in Iran" bugs.

## Inputs required

- Display calendar (Jalali, Gregorian, or user choice) and whether another plugin (for example a "Parsi date" plugin) already converts dates site-wide.
- Store currency (IRR or IRT) and the provider's API docs (gateway or SMS).
- Whether the plugin is also used outside Iran (then keep Persian behavior conditional on locale/settings).

## Procedure

1. Copy `assets/class-persian.php` into the plugin (change its namespace to the plugin's). It provides digit conversion, text normalization, mobile/national code/postal code/Sheba validation, Toman→Rial, and Jalali conversion/formatting that matches ICU's Persian calendar. It is pure PHP, so unit tests don't need WordPress.
2. Route:

| Task | Load |
| --- | --- |
| Showing or parsing dates | `references/jalali-dates.md` |
| Inputs with digits, names, search | `references/digits-and-text.md` |
| Phone, national code, postal code, Sheba | `references/iranian-validation.md` |
| RTL CSS, fonts, blocked external services | `references/rtl-fonts-and-network.md` |
| Translating to fa_IR | `references/fa-ir-translations.md` |
| Payment gateways (with `wp-woocommerce-extension` for WooCommerce) | `references/iranian-gateways.md` |
| SMS sending and OTP login/verification | `references/sms-and-otp.md` |

## Non-negotiable guardrails

- Store dates as UTC timestamps / Gregorian (`Y-m-d H:i:s`); convert to Jalali only for display and from Jalali only when parsing input.
- Normalize digits (`to_latin_digits()`) on every numeric input before validation, comparison, or storage. Store ASCII digits; render Persian digits only in output.
- Amounts sent to gateways and banks are in Rial; convert from the store currency explicitly and verify the same amount you requested.
- Never trust gateway callback parameters; verify server-to-server and make completion idempotent.
- No runtime dependency on services commonly unreachable from Iran (Google Fonts, Google reCAPTCHA, Gravatar, foreign CDNs) for core functionality; bundle assets locally.
- OTPs: hash them, expire them, rate-limit per phone and IP, and never reveal whether an account exists.

## Verification

- Inputs typed with Persian digits (۰۹۱۲...) and Arabic digits (٠٩١٢...) validate the same as ASCII.
- Jalali dates are correct around Nowruz (Esfand 29/30 → Farvardin 1) and leap years; stored values stay Gregorian/UTC.
- Admin and frontend screens look right in `fa_IR` (RTL) and `en_US` (LTR).
- Gateway flow tested in the provider's sandbox: success, cancel (`NOK`), duplicate callback, wrong amount.

## Failure modes / debugging

- "Invalid mobile number" for valid input: digits not normalized, or the user typed `+98` with spaces.
- Dates off by one day: conversion done in UTC instead of the site timezone (`wp_timezone()`, Asia/Tehran).
- Amount mismatch on verify: requested in Toman, verified in Rial (or vice versa).
- Fonts or captchas missing for Iranian visitors: loaded from blocked hosts.
- Search misses results: Arabic `ي`/`ك` vs Persian `ی`/`ک`; normalize search keys.

## Escalation

- Gateway and SMS APIs change; always read the provider's current docs and test in their sandbox before claiming a flow works.
- Legal requirements (e.g. enamad/e-commerce trust seals, SMS sending rules for service vs advertising messages) are outside code; point the user to the provider/regulator.
