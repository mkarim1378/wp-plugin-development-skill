<?php
/**
 * Plugin Name: Rules Plugin
 * Version: 1.0.0
 * Requires at least: 7.0
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 * Text Domain: rules-plugin
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'rules/v1',
			'/items',
			array(
				'methods'  => 'GET',
				'callback' => 'rules_plugin_items',
			)
		);
		register_rest_route(
			'rules/v1',
			'/ok',
			array(
				'methods'             => 'GET',
				'callback'            => 'rules_plugin_items',
				'permission_callback' => 'rules_plugin_can',
			)
		);
	}
);

add_action( 'wp_ajax_nopriv_rules_plugin_ping', 'rules_plugin_ping' );

add_action(
	'init',
	function () {
		register_post_type( 'rules_item', array( 'public' => true ) );
		flush_rewrite_rules();
	}
);

add_action(
	'plugins_loaded',
	function () {
		load_plugin_textdomain( 'rules-plugin', false, 'rules-plugin/languages' );
	}
);

add_option( 'rules_plugin_big', array(), '', true );
update_option( 'rules_plugin_small', 1, false );

function rules_plugin_upload() {
	check_admin_referer( 'rules_plugin_upload' );
	$tmp = isset( $_FILES['file']['tmp_name'] ) ? sanitize_text_field( wp_unslash( $_FILES['file']['tmp_name'] ) ) : '';
	move_uploaded_file( $tmp, WP_CONTENT_DIR . '/x' );
}
