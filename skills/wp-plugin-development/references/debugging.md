# Debugging quick routes

Turn on logging first (in `wp-config.php` of a development site):

```php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );      // wp-content/debug.log
define( 'WP_DEBUG_DISPLAY', false );
define( 'SCRIPT_DEBUG', true );      // unminified core JS/CSS
```

Query Monitor (plugin) shows hooks, queries, HTTP calls, and `_doing_it_wrong` notices per request; see `wp-performance` for headless use.

## Plugin doesn’t load / fatal errors

- Confirm correct plugin main file and header (`node skills/wp-plugin-development/scripts/detect_plugins.mjs`).
- Check PHP error logs and `WP_DEBUG_LOG`.
- If the repo is a site repo, confirm you edited the correct plugin under `wp-content/plugins/`.
- "Cannot redeclare" / "Class already declared": prefix collision with another plugin, or the file is included twice (`require` instead of `require_once`, or both Composer and a manual include).
- Fatal only on some sites: PHP syntax above `Requires PHP`, a missing PHP extension, or a vendor library version conflict with another plugin.
- Recovery mode emails and "There has been a critical error" pages include the file and line; reproduce with `WP_DEBUG_LOG`.

## Activation hook surprises

- Hooks must be registered at top-level.
- Activation runs in a special context; avoid assuming other hooks already ran.
- "The plugin generated N characters of unexpected output": something echoed during activation, or whitespace/BOM before `<?php` / after `?>` in an included file. Remove closing `?>` from PHP-only files.
- Schema changes missing after an update: activation doesn't run on updates; add a version-checked upgrade routine (`lifecycle.md`).

## Settings not saving

- Confirm `register_setting()` is called.
- Confirm the option group matches the form.
- Confirm capability checks and nonces.
- "Sorry, you are not allowed to manage options" with a custom capability: add the `option_page_capability_{$option_group}` filter.
- Value saved but wrong: the sanitize callback dropped it (unchecked checkbox, key not whitelisted) or runs twice on first save.

## Hooks not firing

- Hook added too late (e.g. adding an `init` callback from inside `wp_loaded`) — check with `did_action( 'init' )`.
- Wrong hook name or a filter callback not returning a value.
- Callback removed by another plugin; inspect `$GLOBALS['wp_filter']['hook_name']` or Query Monitor's Hooks panel.
- Admin-only code gated behind `is_admin()` but running on the frontend (or vice versa for AJAX, where `is_admin()` is true).

## 404s on custom post types / rewrite rules

- Rules registered after the flush, or never flushed: re-save Settings > Permalinks or run `wp rewrite flush` to confirm, then fix the activation flow.
- Slug conflicts with a page or another CPT.

## REST / AJAX failures

- 401/403: missing `X-WP-Nonce` (`wp_rest` nonce) for cookie auth, or `permission_callback` returning false. See `wp-rest-api`.
- `admin-ajax.php` returns `0`: no handler registered for that `action` (check `wp_ajax_` vs `wp_ajax_nopriv_`), or the handler didn't `wp_die()`/`wp_send_json_*()`.
- `-1`: nonce check failed.

## Block editor issues

- Styles missing in the editor canvas: assets enqueued with `admin_enqueue_scripts` instead of `enqueue_block_assets` (the canvas is an iframe).
- Script dependency errors (`wp.x is undefined`): handle not listed in dependencies; use the `.asset.php` file.
- Meta not saving from a sidebar: meta not registered with `show_in_rest`, post type lacks `custom-fields` support, or `auth_callback` denies.

## Translation notices

- "Translation loading for the `slug` domain was triggered too early": a translation function ran before `init` (`i18n.md`).
- Strings not translated in JS: missing `wp_set_script_translations()` or text domain mismatch.

## Cron jobs not running

- `wp cron event list` to confirm the event exists; `wp cron event run acme_reviews_daily_sync` to run it now.
- `DISABLE_WP_CRON` set without a system cron; or the callback is only added on activation instead of every request.
