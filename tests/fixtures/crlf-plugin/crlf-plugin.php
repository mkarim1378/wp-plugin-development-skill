<?php
/**
 * Plugin Name: CRLF Plugin
 * Version: 1.0.0
 * Requires at least: 7.0
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 * Text Domain: crlf-plugin
 */
defined( 'ABSPATH' ) || exit;
global $wpdb;
$sql = $wpdb->prepare(
	"SELECT * FROM {$wpdb->posts} WHERE ID = %d",
	$id
);
$row = $wpdb->get_row( $sql );
$raw = $wpdb->get_var( $unknown );
