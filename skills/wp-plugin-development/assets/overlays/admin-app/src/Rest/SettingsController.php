<?php
/**
 * REST endpoint for the admin app.
 *
 * @package {{namespace}}
 */

namespace {{namespace}}\Rest;

use {{namespace}}\Installer;
use {{namespace}}\Settings;
use WP_REST_Request;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * GET/POST /{{slug}}/v1/settings for users who can manage options.
 */
final class SettingsController {

	const NAMESPACE = '{{slug}}/v1';
	const ROUTE     = '/settings';

	/**
	 * Hooks route registration.
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Registers the routes.
	 */
	public function register_routes() {
		register_rest_route(
			self::NAMESPACE,
			self::ROUTE,
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_settings' ),
					'permission_callback' => array( $this, 'can_manage' ),
				),
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'update_settings' ),
					'permission_callback' => array( $this, 'can_manage' ),
					'args'                => array(
						'enabled' => array(
							'type'     => 'boolean',
							'required' => false,
						),
						'title'   => array(
							'type'      => 'string',
							'required'  => false,
							'maxLength' => 200,
						),
					),
				),
			)
		);
	}

	/**
	 * Permission check (the REST cookie nonce is verified by core for logged-in requests).
	 *
	 * @return bool
	 */
	public function can_manage() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Returns the current settings.
	 *
	 * @return array
	 */
	public function get_settings() {
		return Settings::get();
	}

	/**
	 * Merges the submitted values and saves them through the same sanitizer as the settings page.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array
	 */
	public function update_settings( WP_REST_Request $request ) {
		$next = array_merge( Settings::get(), array_intersect_key( $request->get_params(), Settings::defaults() ) );
		update_option( Installer::OPTION_SETTINGS, Settings::sanitize( $next ), false );
		return Settings::get();
	}
}
