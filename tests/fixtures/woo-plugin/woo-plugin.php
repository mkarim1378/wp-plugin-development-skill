<?php
/**
 * Plugin Name: Woo Plugin
 * Version: 1.0.0
 * Requires at least: 7.0
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 * Text Domain: woo-plugin
 */

defined( 'ABSPATH' ) || exit;

function woo_plugin_tracking( $order_id ) {
	$order = wc_get_order( $order_id );
	update_post_meta( $order_id, '_woo_plugin_code', 'x' );
	return get_post_meta( $order->get_id(), '_woo_plugin_code', true );
}

function woo_plugin_recent() {
	global $wpdb;
	$q = new WP_Query( array( 'post_type' => 'shop_order', 'posts_per_page' => 5 ) );
	return $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'shop_order'" );
}

function woo_plugin_ok( WC_Order $order ) {
	$order->update_meta_data( '_woo_plugin_code', 'y' );
	$order->save();
	update_post_meta( 12, '_not_an_order', 1 );
}
