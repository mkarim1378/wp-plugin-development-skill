# RTL, fonts, and network constraints

## RTL

- `fa_IR` makes `is_rtl()` true and adds `dir="rtl"` to admin and themes that support it.
- Prefer CSS logical properties so one stylesheet works in both directions: `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align: start`, `border-inline-start`.
- For legacy CSS, ship `*-rtl.css` (generated with rtlcss; `@wordpress/scripts` does this for its builds) and register it: `wp_style_add_data( $handle, 'rtl', 'replace' )`.
- Icons with direction (arrows, "next"/"back") must flip; icons without direction (search, close) must not.
- Numbers, emails, URLs, codes, and phone numbers inside RTL text need `dir="ltr"` (or `<bdi>`/`unicode-bidi: isolate`) so `09123456789` and `IR06...` don't render scrambled.
- Input fields for numbers/codes: `<input dir="ltr" inputmode="numeric">`.
- Test the admin screens and frontend with `fa_IR` and `en_US`; Settings > General > Site Language switches quickly, or use a user-level language for admin.

## Persian fonts

- Bundle fonts in the plugin (or rely on the theme). Don't load them from Google Fonts or other foreign CDNs.
- Vazirmatn and similar fonts are under the SIL Open Font License; OFL fonts are acceptable in WordPress.org plugins. Keep the license file next to the font.
- Use `font-display: swap` and WOFF2; ship only the weights you use.
- Don't force a font on the whole admin unless that is the plugin's purpose; scope it to your screens.

## Services unreachable or unreliable from Iran

Many foreign services are filtered in Iran or block Iranian IPs (sanctions). If core functionality depends on them, the plugin breaks for Iranian visitors or servers:

- Google Fonts, Google reCAPTCHA, Google Maps, Gravatar (core avatars can be slow), YouTube embeds, some JS CDNs.
- Outbound HTTP from Iranian hosts to some APIs (and inbound callbacks from them) may fail.

Rules:

- Bundle JS/CSS/fonts locally (this is also a WordPress.org guideline).
- Make captchas pluggable (local challenge, honeypot, rate limiting) instead of hard-coding reCAPTCHA.
- Wrap external HTTP calls with short timeouts and graceful fallback (see `wp-plugin-development` `http-api.md`).
- Conversely, Iranian gateway/SMS APIs may reject non-Iranian server IPs; document IP whitelisting requirements (Zarinpal requires registering the merchant server IP).
