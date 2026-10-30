<?php
/**
 * REST settings endpoint tests.
 *
 * @package {{namespace}}
 */

/**
 * Permissions and sanitization of /{{slug}}/v1/settings.
 */
class SettingsControllerTest extends WP_UnitTestCase {

	/**
	 * Fires rest_api_init so routes exist.
	 */
	public function set_up() {
		parent::set_up();
		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server(); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- standard REST test setup.
		do_action( 'rest_api_init', $wp_rest_server );
	}

	/**
	 * Non-admins are rejected.
	 */
	public function test_requires_manage_options() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$response = rest_do_request( new WP_REST_Request( 'GET', '/{{slug}}/v1/settings' ) );
		$this->assertSame( 403, $response->get_status() );
	}

	/**
	 * Admins can save; values are sanitized and unknown keys ignored.
	 */
	public function test_update_sanitizes() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$request = new WP_REST_Request( 'POST', '/{{slug}}/v1/settings' );
		$request->set_body_params(
			array(
				'enabled' => true,
				'title'   => '<b>Hi</b>',
				'evil'    => 'x',
			)
		);
		$response = rest_do_request( $request );
		$this->assertSame( 200, $response->get_status() );
		$this->assertSame(
			array(
				'enabled' => true,
				'title'   => 'Hi',
			),
			$response->get_data()
		);
	}
}
