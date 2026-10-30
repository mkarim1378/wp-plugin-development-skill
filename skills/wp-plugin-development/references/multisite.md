# Multisite and network activation

Use this file when the plugin may run on a WordPress multisite network.

## Activation scopes

- **Per-site activation**: activation runs in the context of one site.
- **Network activation**: the plugin is active on every site, but the activation callback runs once, in the main site's context, with `$network_wide = true`. Sites created later never run it.
- `Network: true` in the header forces network-only activation.

```php
register_activation_hook( __FILE__, function ( $network_wide ) {
	if ( is_multisite() && $network_wide ) {
		// Don't loop over thousands of sites synchronously; schedule or lazy-install instead.
		update_site_option( 'acme_reviews_network_needs_install', 1 );
		return;
	}
	acme_reviews_install_site();
} );

// Sites created after network activation.
add_action( 'wp_initialize_site', function ( WP_Site $site ) {
	if ( is_plugin_active_for_network( plugin_basename( ACME_REVIEWS_FILE ) ) ) {
		switch_to_blog( $site->blog_id );
		acme_reviews_install_site();
		restore_current_blog();
	}
}, 20 );
```

`is_plugin_active_for_network()` lives in `wp-admin/includes/plugin.php`; include it when calling from frontend/cron contexts.

Safer pattern for large networks: run per-site install lazily (on the site's first `admin_init`, checking a per-site version option) instead of iterating all sites at activation.

## Data scope

| Data | API |
| --- | --- |
| Per-site options | `get_option()` / `update_option()` |
| Network-wide options | `get_site_option()` / `update_site_option()` (stored in `sitemeta`) |
| Per-site tables | `$wpdb->prefix` (e.g. `wp_2_acme_reviews`) |
| Network-wide tables | `$wpdb->base_prefix` |
| Per-site transients / network transients | `set_transient()` / `set_site_transient()` |

- Users are global; user meta is shared across sites. Prefix per-site user meta with the blog ID if the value differs per site.
- `switch_to_blog()` changes the database context, not the loaded plugins or theme; every switch needs `restore_current_blog()`. Avoid it inside loops over many sites in a web request.

## Capabilities and admin screens

- Network admin pages: `network_admin_menu`, capability `manage_network_options`.
- `super_admin` users pass every `current_user_can()` check except `do_not_allow`.
- `unfiltered_html` is only granted to super admins on multisite; site admins can't post arbitrary scripts.

## Uninstall on multisite

`uninstall.php` runs once. Clean every site and the network:

```php
defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

if ( is_multisite() ) {
	$site_ids = get_sites( array( 'fields' => 'ids', 'number' => 0 ) );
	foreach ( $site_ids as $site_id ) {
		switch_to_blog( $site_id );
		acme_reviews_uninstall_site(); // defined in this file
		restore_current_blog();
	}
	delete_site_option( 'acme_reviews_network_settings' );
} else {
	acme_reviews_uninstall_site();
}
```

Also clean per-site tables when a site is deleted (`wp_uninitialize_site` action).

## Testing

- Run PHPUnit in multisite mode (`WP_MULTISITE=1` with the core test suite) and test both activation scopes.
- `wp-env` supports multisite via `"multisite": true` in `.wp-env.json` (see `wp-env`); target sites with `--url=` in WP-CLI (see `wp-wpcli-and-ops`).

Upstream reference:

- https://developer.wordpress.org/advanced-administration/multisite/
