<?php
/**
 * Plugin Name: Bad Plugin
 * Version: 1.1.0
 * Text Domain: other-domain
 */
$name = $_POST['name'];
echo $name;
_e( 'Hello', 'other-domain' );
echo __( 'Hi', 'bad-plugin' );
echo esc_html__( $name, 'bad-plugin' );
__( 'No domain' );
__( 'Var domain', MY_DOMAIN );
global $wpdb;
$wpdb->query( "DELETE FROM {$wpdb->prefix}things WHERE id = $id" );
$wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->posts} WHERE post_title = '%s'", $t ) );
$wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->posts}" );
$data = unserialize( $_COOKIE['x'] );
wp_remote_get( $u, array( 'sslverify' => false ) );
wp_redirect( $to );
register_rest_route( 'x/v1', '/y', array( 'permission_callback' => '__return_true' ) );
$q = sanitize_text_field( wp_unslash( $_GET['q'] ?? '' ) ); // fine
echo $raw; // phpcs:ignore WordPress.Security.EscapeOutput
session_start();
setcookie( "bad_plugin_seen", "1" );
