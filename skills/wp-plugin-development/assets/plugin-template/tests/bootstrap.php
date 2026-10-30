<?php
/**
 * PHPUnit bootstrap for the WordPress test suite (wp-env tests-cli or install-wp-tests.sh).
 *
 * @package {{namespace}}
 */

${{prefix}}_tests_dir = getenv( 'WP_TESTS_DIR' );
if ( ! ${{prefix}}_tests_dir ) {
	${{prefix}}_tests_dir = rtrim( sys_get_temp_dir(), '/\\' ) . '/wordpress-tests-lib';
}

if ( ! file_exists( ${{prefix}}_tests_dir . '/includes/functions.php' ) ) {
	fwrite( STDERR, "Could not find {${{prefix}}_tests_dir}/includes/functions.php. Run the tests inside wp-env (npm run test:php).\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite, WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI output before WordPress loads.
	exit( 1 );
}

require_once dirname( __DIR__ ) . '/vendor/yoast/phpunit-polyfills/phpunitpolyfills-autoload.php';
require_once ${{prefix}}_tests_dir . '/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function () {
		require dirname( __DIR__ ) . '/{{slug}}.php';
	}
);

require ${{prefix}}_tests_dir . '/includes/bootstrap.php';
