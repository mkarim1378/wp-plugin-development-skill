# Commercial plugins: licensing and private updates

Use this file for plugins sold outside WordPress.org (premium/pro versions, client plugins) that need updates from your own server and license keys. The scaffold's `--commercial` option generates the updater described here (`src/Updater/Updater.php`).

## Update URI + update_plugins_{$hostname}

Since WP 5.8, a plugin with an `Update URI` header is skipped by WordPress.org update checks and WordPress asks your code instead:

```php
/*
 * Plugin Name: Acme Pro
 * Update URI:  https://updates.acme.com/acme-pro
 */
add_filter( 'update_plugins_updates.acme.com', function ( $update, $plugin_data, $plugin_file, $locales ) {
	if ( plugin_basename( ACME_FILE ) !== $plugin_file ) {
		return $update; // another plugin on the same host
	}
	$remote = acme_fetch_update_info(); // cached, validated
	if ( ! $remote ) {
		return $update;
	}
	return array(
		'slug'         => 'acme-pro',
		'version'      => $remote['version'],   // required; WordPress compares it with the installed version
		'url'          => $remote['url'],
		'package'      => $remote['package'],   // zip URL; omit if the license is inactive
		'tested'       => $remote['tested'],
		'requires_php' => $remote['requires_php'],
		'icons'        => $remote['icons'] ?? array(),
		'banners'      => $remote['banners'] ?? array(),
	);
}, 10, 4 );
```

- The hostname is the host of `Update URI`; WordPress sets `id` and `plugin` itself and copies `version` to `new_version`.
- Returning `false` (the default) means "no info"; returning data with the same version means "up to date".
- Never set `Update URI` to a WordPress.org URL or hijack a slug you don't own.

## "View details" modal

```php
add_filter( 'plugins_api', function ( $result, $action, $args ) {
	if ( 'plugin_information' !== $action || 'acme-pro' !== ( $args->slug ?? '' ) ) {
		return $result;
	}
	$remote = acme_fetch_update_info();
	if ( ! $remote ) {
		return $result;
	}
	return (object) array(
		'name'          => 'Acme Pro',
		'slug'          => 'acme-pro',
		'version'       => $remote['version'],
		'requires'      => $remote['requires'],
		'requires_php'  => $remote['requires_php'],
		'tested'        => $remote['tested'],
		'download_link' => $remote['package'],
		'sections'      => array_map( 'wp_kses_post', (array) $remote['sections'] ),
	);
}, 20, 3 );
```

## Update server response

A static JSON file or an endpoint that returns, for the current license:

```json
{
  "version": "1.3.0",
  "url": "https://acme.com/acme-pro",
  "package": "https://updates.acme.com/acme-pro/download/1.3.0",
  "requires": "7.0",
  "requires_php": "7.4",
  "tested": "7.1",
  "sections": { "changelog": "<h4>1.3.0</h4><ul><li>New: ...</li></ul>" }
}
```

Client rules:

- Cache the response in a transient (e.g. 12 hours); on failure cache a short negative result (1 hour) so a down server isn't hit on every admin page load.
- Validate before use: `version` matches `/^\d+(\.\d+){0,3}$/`, `package` is `https://` on your update host, sections pass through `wp_kses_post()`.
- Clear the cache when the license key changes and after the plugin updates.

## License keys

- Store the key in a non-autoloaded option; mask it in the UI (`type="password"`, show last 4 chars).
- Send it to your server only over HTTPS and only to your update host, in a header (`X-Acme-License`) added with the `http_request_args` filter for that host, so it doesn't end up in URLs and server logs. This also authenticates the package download WordPress performs.
- Activation: POST key + `home_url()` to the license server; store the returned status. Re-check daily (cron) and on the settings page, not on every request.
- Bind licenses to sites the server knows about; let customers deactivate a site from their account.
- Disclose what the plugin sends (site URL, plugin/WP/PHP versions) in `readme.txt` (External services) and the privacy policy text.

## Fail safe

- A missing/expired license disables **updates and support features**, not the site: never fatal, never disable features the customer already uses on the frontend, never delete data.
- No remote kill switch, no remote code execution, no obfuscated code. A license server outage must leave the plugin working.
- Show one dismissible admin notice to users who can manage the license (`manage_options`), on relevant screens only.

## Free version on WordPress.org

- The free plugin must be fully functional on its own; locked features, trial periods, or license checks that disable functionality in the free plugin violate guideline 5 (trialware).
- Sell the pro features as a separate plugin (with `Requires Plugins: acme` if it depends on the free one) that uses its own `Update URI`.
- Upsell notices in the free plugin: limited to its own screens, dismissible (guideline 11).

## Optional: package signatures

For high-assurance updates, sign zips on the server with Ed25519 and verify before installing (the `upgrader_pre_download` filter can download and verify with `sodium_crypto_sign_verify_detached()`; core ships sodium_compat). Keep the public key in the plugin.
