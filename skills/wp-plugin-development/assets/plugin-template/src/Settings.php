<?php
/**
 * Settings storage.
 *
 * @package {{namespace}}
 */

namespace {{namespace}};

defined( 'ABSPATH' ) || exit;

/**
 * Reads and sanitizes the plugin's single settings option.
 */
final class Settings {

	/**
	 * Default values.
	 *
	 * @return array{enabled: bool, title: string}
	 */
	public static function defaults() {
		return array(
			'enabled' => false,
			'title'   => '',
		);
	}

	/**
	 * Current settings merged over defaults.
	 *
	 * @return array{enabled: bool, title: string}
	 */
	public static function get() {
		$saved = get_option( Installer::OPTION_SETTINGS, array() );
		return array_merge( self::defaults(), is_array( $saved ) ? $saved : array() );
	}

	/**
	 * Sanitize callback for register_setting(). Must stay pure: it runs on every update_option().
	 *
	 * @param mixed $input Raw submitted value.
	 * @return array{enabled: bool, title: string}
	 */
	public static function sanitize( $input ) {
		$input = is_array( $input ) ? $input : array();
		return array(
			'enabled' => ! empty( $input['enabled'] ),
			'title'   => isset( $input['title'] ) ? sanitize_text_field( $input['title'] ) : '',
		);
	}
}
