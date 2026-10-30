<?php
/**
 * Plugin Name:       Good Plugin
 * Version:           1.0.0
 * Requires at least: 7.0
 * Requires PHP:      7.4
 * License:           GPL-2.0-or-later
 * Text Domain:       good-plugin
 */

defined( 'ABSPATH' ) || exit;

add_action( 'admin_post_good_save', function () {
	check_admin_referer( 'good_save' );
	$title = isset( $_POST['title'] ) ? sanitize_text_field( wp_unslash( $_POST['title'] ) ) : '';
	echo esc_html( $title );
	printf( esc_html( _n( '%d item', '%d items', $n, 'good-plugin' ) ), (int) $n );
	esc_html_e( 'Saved', 'good-plugin' );
	global $wpdb;
	$wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}good WHERE id = %d", $id ) );
} );
