<?php
/**
 * Plugin Name:       {{name}}
 * Plugin URI:        {{plugin_uri}}
 * Description:       {{description}}
 * Version:           {{version}}
 * Requires at least: {{wp_min}}
 * Requires PHP:      {{php_min}}
 * Author:            {{author}}
 * Author URI:        {{author_uri}}
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       {{slug}}
 * Domain Path:       /languages
{{#requires_plugins}}
 * Requires Plugins:  {{requires_plugins}}
{{/requires_plugins}}
{{#woocommerce}}
 * WC requires at least: {{wc_min}}
 * WC tested up to:   {{wc_tested}}
{{/woocommerce}}
{{#elementor}}
 * Elementor tested up to: {{elementor_tested}}
{{/elementor}}
{{#update_uri}}
 * Update URI:        {{update_uri}}
{{/update_uri}}
 *
 * @package {{namespace}}
 */

defined( 'ABSPATH' ) || exit;

define( '{{PREFIX}}_VERSION', '{{version}}' );
define( '{{PREFIX}}_DB_VERSION', '1' );
define( '{{PREFIX}}_FILE', __FILE__ );
define( '{{PREFIX}}_DIR', plugin_dir_path( __FILE__ ) );
define( '{{PREFIX}}_URL', plugin_dir_url( __FILE__ ) );

if ( ! is_readable( {{PREFIX}}_DIR . 'vendor/autoload.php' ) ) {
	add_action(
		'admin_notices',
		static function () {
			wp_admin_notice(
				esc_html__( '{{name}} is missing its dependencies. Run "composer install" or reinstall the plugin.', '{{slug}}' ),
				array( 'type' => 'error' )
			);
		}
	);
	return;
}
require_once {{PREFIX}}_DIR . 'vendor/autoload.php';

register_activation_hook( __FILE__, array( \{{namespace}}\Installer::class, 'activate' ) );
register_deactivation_hook( __FILE__, array( \{{namespace}}\Installer::class, 'deactivate' ) );

{{#woocommerce}}
add_action(
	'before_woocommerce_init',
	static function () {
		if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', __FILE__, true );
		}
	}
);

{{/woocommerce}}
add_action( 'plugins_loaded', array( \{{namespace}}\Plugin::class, 'boot' ) );
