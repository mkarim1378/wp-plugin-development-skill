# Security audit procedure

Use this file to review a whole plugin (your own before release, a client's, or a third-party plugin you are about to install). `security.md` lists the rules; this file is the procedure for finding where they are broken.

Scope it first: confirm whether the task is review-only or includes fixes, and whether the plugin is public (WordPress.org) or private. Report findings with file:line evidence, severity, and a concrete fix; never claim "secure" — say what was checked.

## 1. Map the attack surface

```bash
node skills/wp-plugin-development/scripts/list_entry_points.mjs <plugin-dir> --format md
```

It lists every entry point with its callback and whether the callback (or a `$this->`/`self::` helper) verifies a nonce and checks a capability:

| Kind | Who can reach it | Must have |
| --- | --- | --- |
| `ajax` (`wp_ajax_*`) | any logged-in user, including subscribers | nonce + capability |
| `ajax` public (`wp_ajax_nopriv_*`) | anyone | input validation, rate limiting, public data only |
| `admin-post` | logged-in (or anyone with `nopriv`) | nonce + capability |
| `rest` | depends on `permission_callback` | a real `permission_callback`; `__return_true` only for public read-only data |
| `request-handler` (`init`, `admin_init`, `template_redirect` callbacks reading request data) | anyone (`admin_init` also runs for admin-ajax/admin-post, i.e. any logged-in user) | nonce + capability before any state change |
| `admin-page` | users with the page capability | nonce for forms; capability re-checked in handlers |
| `shortcode` | post authors set attributes, visitors see output | escaped output |
| `wc-api` (`woocommerce_api_*`) | anyone (gateway callbacks) | server-to-server verification, idempotency |
| `cron` | no user | no capability-gated logic, idempotent |

Then add what the script can't see:

- Hooks registered with dynamic names (`'wp_ajax_' . $action`) — listed as `dynamic-hook`; enumerate the real actions.
- File-level code that runs on include (top-level `if ( isset( $_GET[...] ) )`).
- Standalone PHP files reachable directly by URL (any file without an `ABSPATH` guard that does work).
- Custom rewrite endpoints and query vars handled in `template_redirect` / `parse_request`.
- Webhook receivers, OAuth callbacks, file download handlers, import/export features.

## 2. Review each entry point

For every `high` and `review` entry, read the callback and answer:

1. **Authentication/authorization**: who can call it, and is that intended? Capability matches the action (`edit_post` with an ID, `manage_options` for settings), not just "logged in". Object-level checks: can user A act on user B's data by changing an ID (IDOR)?
2. **CSRF**: state-changing requests verify a nonce with a specific action (REST cookie auth: core checks `X-WP-Nonce`; custom auth schemes need their own checks).
3. **Input**: each value read explicitly, unslashed, sanitized/validated by type; allow lists for enums, column names, and order directions.
4. **Data access**: SQL prepared (`%d %s %f %i`); no user input in `include`/`require`, file paths, `unserialize()`, `extract()`, `call_user_func()` targets, or option names.
5. **Output**: escaped late for its context, in PHP templates, JSON passed to JS, admin notices, emails, and CSV exports (formula injection: prefix cells starting with `= + - @`).
6. **Side effects**: redirects use `wp_safe_redirect()`; outbound requests to user URLs use `wp_safe_remote_*()`; uploads go through `wp_handle_upload()` with type checks; emails can't be pointed at arbitrary recipients by anonymous users.
7. **Information leaks**: no private data in public responses, errors, HTML comments, JS globals, or logs.

## 3. Sweep for dangerous patterns

```bash
node skills/wp-plugin-development/scripts/check_plugin_basics.mjs <plugin-dir>
vendor/bin/phpcs --standard=WordPress --sniffs=WordPress.Security.EscapeOutput,WordPress.Security.NonceVerification,WordPress.Security.ValidatedSanitizedInput,WordPress.DB.PreparedSQL <plugin-dir>
```

Then search manually for what heuristics miss:

```bash
grep -rnE "unserialize\(|maybe_unserialize\(\$_|extract\(|eval\(|assert\(|create_function|preg_replace\(.*/e|call_user_func(_array)?\(\s*\$_|\\\$\$" --include=*.php <plugin-dir>
grep -rnE "(include|require)(_once)?\s*\(?\s*\$" --include=*.php <plugin-dir>
grep -rnE "file_put_contents|fopen\(|move_uploaded_file|copy\(|unlink\(" --include=*.php <plugin-dir>
grep -rnE "wp_redirect\(|header\(\s*['\"]Location" --include=*.php <plugin-dir>
grep -rnE "(shell_exec|exec|system|passthru|popen|proc_open)\(" --include=*.php <plugin-dir>
grep -rnE "is_admin\(\)" --include=*.php <plugin-dir>   # often misused as an authorization check
```

Also check:

- Bundled libraries in `vendor/` or `lib/`: versions with known CVEs (compare `composer.lock` or library headers with advisories).
- JavaScript: `innerHTML`/`dangerouslySetInnerHTML`/jQuery `.html()` with server or URL data; `postMessage` handlers without origin checks.
- Settings that lower-privileged roles can change and that are later printed in wp-admin (stored XSS against admins).
- Multisite: site admins don't have `unfiltered_html`; network-wide options need `manage_network_options`.

## 4. Report

For each finding:

| Field | Content |
| --- | --- |
| Title | e.g. "Missing capability check in `wp_ajax_acme_delete`" |
| Severity | Critical (unauthenticated RCE/SQLi/privilege escalation) · High (authenticated low-privilege → admin impact, stored XSS against admins, CSRF on destructive actions) · Medium · Low |
| Location | `file.php:line` and the entry point that reaches it |
| Who can exploit | anonymous / subscriber / author / admin |
| Evidence | the code path, and a reproduction if safe to run locally |
| Fix | the specific change (add `check_ajax_referer( 'acme_delete' )` + `current_user_can( 'delete_post', $id )`) |

Close with what was **not** checked (dynamic hooks not enumerated, JS not reviewed, vendor libraries not audited) so nobody reads the report as a guarantee.

## 5. Fix and verify

- Fix in order of severity; add a regression test per finding (PHPUnit: call the handler as a subscriber / without a nonce and assert it is rejected).
- Re-run `list_entry_points.mjs`; every remaining `high` must be justified in the report.
- For vulnerabilities in released plugins: patch privately, release, then disclose; WordPress.org plugins can coordinate with the Plugin Review Team (plugins@wordpress.org), and many researchers report through Wordfence/Patchstack/WPScan.
