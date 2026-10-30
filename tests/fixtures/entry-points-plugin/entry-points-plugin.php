<?php
/**
 * Plugin Name: Entry Points Plugin
 * Version: 1.0.0
 * Text Domain: entry-points-plugin
 */

defined( 'ABSPATH' ) || exit;

require __DIR__ . '/includes/class-ep-admin.php';

add_action( 'wp_ajax_ep_delete', 'ep_delete_item' );
add_action( 'wp_ajax_ep_safe', 'ep_safe_item' );
add_action( 'wp_ajax_nopriv_ep_track', 'ep_track' );
add_action( 'admin_post_ep_export', array( 'EP_Admin', 'export' ) );
add_shortcode( 'ep_box', 'ep_box_shortcode' );
add_action( 'init', 'ep_maybe_reset' );
add_action( 'ep_daily_cleanup', 'ep_cleanup' );
add_action( 'woocommerce_api_ep_gateway', 'ep_gateway_callback' );

register_activation_hook( __FILE__, function () {
	wp_schedule_event( time(), 'daily', 'ep_daily_cleanup' );
} );

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'ep/v1',
			'/items',
			array(
				'methods'  => 'GET',
				'callback' => 'ep_rest_items',
			)
		);
		register_rest_route(
			'ep/v1',
			'/public',
			array(
				'methods'             => 'GET',
				'callback'            => 'ep_rest_items',
				'permission_callback' => '__return_true',
			)
		);
	}
);

function ep_delete_item() {
	$id = absint( $_POST['id'] );
	wp_delete_post( $id );
}

function ep_safe_item() {
	check_ajax_referer( 'ep_safe' );
	if ( ! current_user_can( 'edit_posts' ) ) {
		wp_send_json_error();
	}
	update_option( 'ep_safe', 1 );
}

function ep_track() {
	update_option( 'ep_hits', (int) get_option( 'ep_hits' ) + 1 );
}

function ep_box_shortcode( $atts ) {
	return '<div>' . esc_html( $atts['title'] ?? '' ) . '</div>';
}

function ep_maybe_reset() {
	if ( isset( $_GET['ep_reset'] ) ) {
		delete_option( 'ep_settings' );
	}
}

function ep_cleanup() {
	delete_transient( 'ep_cache' );
}

function ep_gateway_callback() {
	$ref = sanitize_text_field( wp_unslash( $_GET['ref'] ?? '' ) );
}

function ep_rest_items() {
	return array();
}
