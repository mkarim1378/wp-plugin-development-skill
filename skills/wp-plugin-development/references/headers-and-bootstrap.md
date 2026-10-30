# Plugin headers and bootstrap

Use this file when creating a plugin or touching its main file.

## Main file header

WordPress reads the header from the first 8 KB of the main PHP file in the plugin's top-level directory. Only `Plugin Name` is required, but set all of these for a distributable plugin:

```php
<?php
/**
 * Plugin Name:       Acme Reviews
 * Plugin URI:        https://example.com/acme-reviews
 * Description:       Collect and display product reviews.
 * Version:           1.0.0
 * Requires at least: 7.0
 * Requires PHP:      7.4
 * Author:            Acme
 * Author URI:        https://example.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       acme-reviews
 * Domain Path:       /languages
 * Requires Plugins:  woocommerce
 *
 * @package AcmeReviews
 */

defined( 'ABSPATH' ) || exit;
```

Field notes:

- `Text Domain` must equal the plugin slug (directory name) for WordPress.org translations.
- `Requires at least` / `Requires PHP` are enforced: WordPress refuses to activate or auto-update when the site doesn't meet them. Keep them in sync with `readme.txt`.
- `Requires Plugins` (WP 6.5+) is a comma-separated list of WordPress.org slugs. WordPress blocks activation until dependencies are active and prevents deactivating a dependency. It only takes slugs, not versions; check versions at runtime yourself.
- `Update URI` stops WordPress.org from offering updates for a same-slug plugin. Set it for private or commercially hosted plugins; don't set it for WordPress.org plugins.
- `Network: true` makes the plugin network-activate only on multisite.
- `Domain Path` is only needed when shipping your own `.mo`/`.l10n.php` files.
- License must be GPL-2.0-or-later or a GPL-compatible license (see `wp-plugin-directory-guidelines`).

## Bootstrap pattern

The main file should only: guard direct access, define constants, load the autoloader, register lifecycle hooks, and hook the plugin's start.

```php
define( 'ACME_REVIEWS_VERSION', '1.0.0' );
define( 'ACME_REVIEWS_FILE', __FILE__ );
define( 'ACME_REVIEWS_DIR', plugin_dir_path( __FILE__ ) );
define( 'ACME_REVIEWS_URL', plugin_dir_url( __FILE__ ) );

require_once ACME_REVIEWS_DIR . 'vendor/autoload.php'; // or a small PSR-4 autoloader

register_activation_hook( __FILE__, array( \Acme\Reviews\Installer::class, 'activate' ) );
register_deactivation_hook( __FILE__, array( \Acme\Reviews\Installer::class, 'deactivate' ) );

add_action( 'plugins_loaded', array( \Acme\Reviews\Plugin::class, 'boot' ) );
```

Rules:

- Lifecycle hooks are registered at top level of the main file with that file's `__FILE__`.
- `plugins_loaded` is the earliest safe point to check for other plugins (`class_exists()`, `defined()`), and the place to run version-checked upgrade routines.
- If the autoloader file may be missing (development checkout without `composer install`), fail with an admin notice instead of a fatal.
- Don't output anything from the main file; stray whitespace or BOM before `<?php` causes "headers already sent" and activation "unexpected output" errors.

## Runtime requirement checks

Header checks cover WordPress/PHP versions. For anything else (PHP extensions, dependency plugin versions), check on `plugins_loaded` and degrade gracefully:

```php
add_action( 'plugins_loaded', function () {
	if ( ! defined( 'WC_VERSION' ) || version_compare( WC_VERSION, '9.0', '<' ) ) {
		add_action( 'admin_notices', function () {
			wp_admin_notice(
				esc_html__( 'Acme Reviews requires WooCommerce 9.0 or newer.', 'acme-reviews' ),
				array( 'type' => 'error' )
			);
		} );
		return;
	}
	\Acme\Reviews\Plugin::boot();
} );
```

## Directory layout (suggested, not required)

```
acme-reviews/
├── acme-reviews.php      # header + bootstrap only
├── uninstall.php
├── readme.txt
├── composer.json         # PSR-4 autoload for src/
├── package.json          # @wordpress/scripts if there is JS
├── src/                  # namespaced PHP classes
│   ├── Plugin.php
│   ├── Installer.php
│   ├── Admin/
│   └── Rest/
├── blocks/               # block.json sources (built into build/)
├── assets/ or build/     # compiled JS/CSS, *.asset.php
├── languages/
└── tests/
```

Match the existing structure when one exists. The upstream Plugin Handbook boilerplate (`includes/`, `admin/`, `public/` with `class-*.php` files) is equally valid.

Upstream references:

- https://developer.wordpress.org/plugins/plugin-basics/header-requirements/
- https://make.wordpress.org/core/2024/03/05/introducing-plugin-dependencies-in-wordpress-6-5/
