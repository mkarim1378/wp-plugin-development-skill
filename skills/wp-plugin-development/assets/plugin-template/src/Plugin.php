<?php
/**
 * Plugin bootstrap.
 *
 * @package {{namespace}}
 */

namespace {{namespace}};

defined( 'ABSPATH' ) || exit;

/**
 * Wires the plugin's services to WordPress hooks.
 */
final class Plugin {

	/**
	 * Called on plugins_loaded.
	 */
	public static function boot() {
{{#woocommerce}}
		if ( ! class_exists( 'WooCommerce' ) ) {
			return; // Requires Plugins header normally prevents this; stay inert if WooCommerce is missing.
		}

{{/woocommerce}}
		Installer::maybe_upgrade();

		if ( is_admin() ) {
			( new Admin\SettingsPage() )->register();
		}
{{#woocommerce}}

		( new WooCommerce\Integration() )->register();
{{/woocommerce}}
{{#commercial}}

		( new Updater\Updater( {{PREFIX}}_FILE, {{PREFIX}}_VERSION ) )->register();
{{/commercial}}
{{#elementor}}

		( new Elementor\Integration() )->register();
{{/elementor}}
	}
}
