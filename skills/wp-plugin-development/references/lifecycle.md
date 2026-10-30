# Activation, deactivation, uninstall, and upgrades

Use this file for lifecycle changes, schema/data migrations, and data cleanup.

## Activation / deactivation hooks

- `register_activation_hook( __FILE__, 'callback' )`
- `register_deactivation_hook( __FILE__, 'callback' )`

Guardrails:

- These hooks must be registered at top level of the main plugin file (not inside other hooks, not from an included file with a different `__FILE__`).
- Activation runs during a redirect-style request: output (including notices and whitespace) becomes "The plugin generated N characters of unexpected output". Don't echo; store a transient and show a notice on the next admin page load instead.
- Other plugins' `plugins_loaded`/`init` callbacks may not have run with your code in scope. Call the functions you need directly (for example, the same function that registers CPTs on `init`) instead of assuming hooks fired.
- If you flush rewrite rules, register the rules first, then `flush_rewrite_rules()`. On deactivation, unregister (or simply don't register) and flush again. Never flush on every request.
- On multisite, the activation callback receives `$network_wide`; see `multisite.md`.

Typical activation work: create tables (`dbDelta`), add default options (with explicit autoload), schedule cron events, add custom capabilities to roles, set a "needs setup" flag.

Typical deactivation work: unschedule cron hooks (`wp_clear_scheduled_hook()`), flush rewrite rules. Deactivation is reversible, so **don't delete user data on deactivation**.

## Upgrade routines (activation does not run on updates)

Plugin updates (auto-update, upload, WP-CLI, `git pull`) don't trigger the activation hook. Any schema or data change needs a version-checked routine:

```php
add_action( 'plugins_loaded', function () {
	$installed = get_option( 'acme_reviews_db_version', '0' );
	if ( version_compare( $installed, ACME_REVIEWS_DB_VERSION, '>=' ) ) {
		return;
	}
	\Acme\Reviews\Installer::upgrade( $installed ); // idempotent, step by step
	update_option( 'acme_reviews_db_version', ACME_REVIEWS_DB_VERSION, false );
} );
```

Guardrails:

- Keep a separate DB/schema version from the plugin version so releases without migrations don't run anything.
- Each migration step is idempotent and ordered (`if ( version_compare( $installed, '1.2.0', '<' ) ) { ... }`).
- Long migrations (many rows) run in batches through cron or Action Scheduler, not inside a page request.
- Concurrent requests can run the check at the same time; guard expensive or non-idempotent steps with a short-lived lock (an option added with `add_option()`, which fails if it already exists).
- The `upgrader_process_complete` hook runs in the context of the *old* code during the update; don't rely on it for migrations.

## Uninstall

Preferred approaches:

- `uninstall.php` in the plugin root (runs only on uninstall, without the plugin being loaded).
- `register_uninstall_hook( __FILE__, 'static_callback' )` — the callback must be a function or static method, not a closure or an object method.

`uninstall.php` template:

```php
<?php
defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'acme_reviews_settings' );
delete_option( 'acme_reviews_db_version' );
delete_transient( 'acme_reviews_cache' );
wp_clear_scheduled_hook( 'acme_reviews_daily_sync' );

global $wpdb;
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}acme_reviews" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
delete_metadata( 'post', 0, '_acme_reviews_rating', '', true ); // delete for all posts
```

Guardrails:

- Check `WP_UNINSTALL_PLUGIN` before running destructive cleanup.
- Remove only what the plugin created. Content the user authored (posts of your CPT, uploads) is a product decision: either keep it or make deletion opt-in through a setting ("Delete all data on uninstall").
- Remove custom capabilities you added to roles.
- On multisite, clean every site (see `multisite.md`) and any network options (`delete_site_option()`).

Upstream reference:

- https://developer.wordpress.org/plugins/plugin-basics/activation-deactivation-hooks/
- https://developer.wordpress.org/plugins/plugin-basics/uninstall-methods/
