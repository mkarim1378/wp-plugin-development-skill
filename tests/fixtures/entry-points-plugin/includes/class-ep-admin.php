<?php
defined( 'ABSPATH' ) || exit;

class EP_Admin {
	public static function register() {
		add_options_page( 'EP', 'EP', 'manage_options', 'ep-settings', array( __CLASS__, 'render' ) );
	}

	public static function export() {
		self::guard();
		echo wp_json_encode( get_option( 'ep_settings' ) );
	}

	private static function guard() {
		check_admin_referer( 'ep_export' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'no' );
		}
	}

	public static function render() {
		if ( isset( $_POST['ep_title'] ) ) {
			update_option( 'ep_title', sanitize_text_field( wp_unslash( $_POST['ep_title'] ) ) );
		}
	}
}
