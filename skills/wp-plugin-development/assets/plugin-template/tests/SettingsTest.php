<?php
/**
 * Settings tests.
 *
 * @package {{namespace}}
 */

use {{namespace}}\Installer;
use {{namespace}}\Settings;

/**
 * Covers sanitization, defaults and the upgrade routine.
 */
class SettingsTest extends WP_UnitTestCase {

	/**
	 * Markup is stripped and unknown keys are dropped.
	 */
	public function test_sanitize_strips_markup_and_unknown_keys() {
		$clean = Settings::sanitize(
			array(
				'enabled' => '1',
				'title'   => '<b>Hello</b>',
				'evil'    => 'x',
			)
		);
		$this->assertSame(
			array(
				'enabled' => true,
				'title'   => 'Hello',
			),
			$clean
		);
	}

	/**
	 * Non-array input falls back to defaults.
	 */
	public function test_sanitize_handles_non_array_input() {
		$this->assertSame( Settings::defaults(), Settings::sanitize( 'nope' ) );
	}

	/**
	 * The upgrade routine creates settings once and never overwrites them.
	 */
	public function test_upgrade_creates_settings_once() {
		delete_option( Installer::OPTION_SETTINGS );
		delete_option( Installer::OPTION_DB_VERSION );

		Installer::maybe_upgrade();
		$this->assertSame( Settings::defaults(), get_option( Installer::OPTION_SETTINGS ) );
		$this->assertSame( {{PREFIX}}_DB_VERSION, get_option( Installer::OPTION_DB_VERSION ) );

		update_option(
			Installer::OPTION_SETTINGS,
			array(
				'enabled' => true,
				'title'   => 'Kept',
			)
		);
		Installer::maybe_upgrade();
		$this->assertSame( 'Kept', Settings::get()['title'] );
	}

	/**
	 * Only users who can manage options reach the settings page.
	 */
	public function test_settings_page_requires_manage_options() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$this->assertFalse( current_user_can( 'manage_options' ) );
	}
}
