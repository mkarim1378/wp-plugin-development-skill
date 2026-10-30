# Data storage, cron, and upgrades

Use this file when adding persistent storage, caching, or background jobs. For schema upgrade routines see `lifecycle.md`.

## Choosing storage

| Data | Store in |
| --- | --- |
| Small plugin config | One array option (Options API) |
| Per-post / per-user / per-term data | Metadata (`update_post_meta()` etc.), registered with `register_meta()` |
| Content users create and manage | A custom post type (gets revisions, REST, admin UI, capabilities) |
| Cached remote/computed data | Transients or the object cache |
| High-volume rows queried by several columns (logs, events, orders) | A custom table |

Custom tables are justified when you need indexed queries over many rows that meta queries can't serve efficiently. They cost you migrations, export/erase support, and multisite handling.

## Options and autoload

- Autoloaded options are loaded on every request. Default to not autoloading anything that isn't needed on most page loads.
- WP 6.6+: `add_option()` / `update_option()` take `true`/`false` (force) or `null` (let WordPress decide). With `null`, WordPress stores `auto` and skips autoloading large values (filter: `wp_max_autoloaded_option_size`).
- Change autoload for existing options with `wp_set_option_autoload()` / `wp_set_options_autoload()`.
- Options store serialized PHP; keep values to plain arrays/scalars, never objects.
- Use `get_option( 'name', $default )` and handle the default; don't assume the option exists.
- See `wp-performance` for diagnosing autoload bloat.

## Transients and object cache

- `set_transient( $key, $value, $expiration )` — key ≤ 172 characters; always set an expiration.
- Transients may disappear before they expire (object cache eviction, `wp transient delete`). Code must treat a miss as normal and recompute.
- Don't store a value of `false` in a transient: it's indistinguishable from a miss.
- With a persistent object cache, transients live in the cache, not the options table.
- `wp_cache_get()` / `wp_cache_set()` with a plugin-specific group are request-scoped without a persistent cache; use them for repeated work inside one request.
- Use `set_site_transient()` for network-wide data on multisite.
- Page caches, purging, and object-cache groups: see `caching-compatibility.md`.

## Custom tables

```php
function acme_reviews_install_tables() {
	global $wpdb;
	require_once ABSPATH . 'wp-admin/includes/upgrade.php';

	$table   = $wpdb->prefix . 'acme_reviews';
	$charset = $wpdb->get_charset_collate();

	dbDelta( "CREATE TABLE {$table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  post_id bigint(20) unsigned NOT NULL,
  rating tinyint(3) unsigned NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY post_id (post_id)
) {$charset};" );
}
```

`dbDelta()` is picky: one column per line, two spaces between `PRIMARY KEY` and the column list, `KEY` (not `INDEX`), lowercase types, no backticks, no trailing comma. Avoid zero-date defaults (`'0000-00-00 00:00:00'`): they fail under MySQL strict mode; set dates on insert instead. It adds and alters columns but never drops them; drop columns in an explicit migration step.

Use `$wpdb->prefix` (per site) or `$wpdb->base_prefix` (network-wide table) deliberately on multisite.

## Database safety note

If using `$wpdb->prepare()`, avoid building queries with concatenated user input.
The `%i` identifier placeholder is available from WordPress 6.2, so it is safe for plugins targeting WP 7.0+; check the plugin's `Requires at least` before relying on it in plugins that support older versions.

## Cron

- Ensure tasks are idempotent (may run late or multiple times).
- Provide a manual trigger path for debugging (WP-CLI or admin-only action).

```php
// Activation
if ( ! wp_next_scheduled( 'acme_reviews_daily_sync' ) ) {
	wp_schedule_event( time(), 'daily', 'acme_reviews_daily_sync' );
}

// Always (outside the activation callback)
add_action( 'acme_reviews_daily_sync', 'acme_reviews_run_sync' );

// Deactivation
wp_clear_scheduled_hook( 'acme_reviews_daily_sync' );
```

Guardrails:

- WP-Cron is triggered by page visits; on low-traffic sites jobs run late, and with `DISABLE_WP_CRON` they depend on a system cron. Don't promise exact times.
- Custom intervals: `cron_schedules` filter. Register the filter on every request, not only on activation.
- Pass arguments as the third parameter; the same hook with different args is a different event, and `wp_next_scheduled()` / `wp_clear_scheduled_hook()` must use the same args.
- Long jobs: process in batches and reschedule a single event (`wp_schedule_single_event()`) for the next batch, or use Action Scheduler if the project already ships it (WooCommerce does).
- Cron runs as no user: `current_user_can()` is false. Don't run capability-gated code paths from cron, and don't use cron callbacks as an authorization bypass.
- Check `wp cron event list` to verify scheduling (see `wp-wpcli-and-ops`).

Upstream reference:

- https://developer.wordpress.org/plugins/cron/
- https://developer.wordpress.org/apis/options/
