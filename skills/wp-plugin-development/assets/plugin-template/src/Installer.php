<?php
/**
 * Activation, deactivation and upgrades.
 *
 * @package {{namespace}}
 */

namespace {{namespace}};

defined( 'ABSPATH' ) || exit;

/**
 * Lifecycle handling. Activation does not run on updates, so schema/data
 * changes go through maybe_upgrade(), which runs on every plugins_loaded.
 */
final class Installer {

	const OPTION_DB_VERSION = '{{prefix}}_db_version';
	const OPTION_SETTINGS   = '{{prefix}}_settings';

	/**
	 * Activation callback.
	 *
	 * @param bool $network_wide Whether the plugin is being network-activated.
	 */
	public static function activate( $network_wide = false ) {
		if ( is_multisite() && $network_wide ) {
			// Per-site setup runs lazily through maybe_upgrade() on each site.
			return;
		}
		self::maybe_upgrade();
	}

	/**
	 * Deactivation callback. Never deletes user data.
	 */
	public static function deactivate() {
		wp_clear_scheduled_hook( '{{prefix}}_daily' );
	}

	/**
	 * Runs pending upgrade steps once per DB version.
	 */
	public static function maybe_upgrade() {
		$installed = (string) get_option( self::OPTION_DB_VERSION, '0' );
		if ( version_compare( $installed, {{PREFIX}}_DB_VERSION, '>=' ) ) {
			return;
		}

		if ( version_compare( $installed, '1', '<' ) ) {
			add_option( self::OPTION_SETTINGS, Settings::defaults(), '', false );
		}

		update_option( self::OPTION_DB_VERSION, {{PREFIX}}_DB_VERSION, false );
	}
}
