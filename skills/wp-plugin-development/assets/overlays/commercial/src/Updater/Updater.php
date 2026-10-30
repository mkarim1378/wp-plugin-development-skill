<?php
/**
 * Private updates through the Update URI header.
 *
 * @package {{namespace}}
 */

namespace {{namespace}}\Updater;

defined( 'ABSPATH' ) || exit;

/**
 * Answers WordPress update checks from the update server, sends the license key only to that host,
 * and fails safe: any error means "no update", never a broken site.
 */
final class Updater {

	const UPDATE_URI     = '{{update_uri}}';
	const INFO_URL       = '{{update_api}}';
	const SLUG           = '{{slug}}';
	const OPTION_LICENSE = '{{prefix}}_license_key';
	const CACHE_KEY      = '{{prefix}}_update_info';
	const LICENSE_HEADER = 'X-{{namespace_header}}-License';

	/**
	 * Main plugin file.
	 *
	 * @var string
	 */
	private $file;

	/**
	 * Installed version.
	 *
	 * @var string
	 */
	private $version;

	/**
	 * Constructor.
	 *
	 * @param string $file    Main plugin file.
	 * @param string $version Installed version.
	 */
	public function __construct( $file, $version ) {
		$this->file    = $file;
		$this->version = $version;
	}

	/**
	 * Hooks into the update system.
	 */
	public function register() {
		add_filter( 'update_plugins_' . self::host(), array( $this, 'check_update' ), 10, 3 );
		add_filter( 'plugins_api', array( $this, 'plugin_information' ), 20, 3 );
		add_filter( 'http_request_args', array( $this, 'add_license_header' ), 10, 2 );
		add_action( 'update_option_' . self::OPTION_LICENSE, array( self::class, 'clear_cache' ) );
		add_action( 'upgrader_process_complete', array( self::class, 'clear_cache' ) );
	}

	/**
	 * Hostname of the update server (the dynamic part of update_plugins_{$hostname}).
	 *
	 * @return string
	 */
	public static function host() {
		return (string) wp_parse_url( self::UPDATE_URI, PHP_URL_HOST );
	}

	/**
	 * Filter: update_plugins_{$hostname}.
	 *
	 * @param array|false $update      Existing update data (false by default).
	 * @param array       $plugin_data Plugin headers.
	 * @param string      $plugin_file Plugin basename.
	 * @return array|false
	 */
	public function check_update( $update, $plugin_data, $plugin_file ) {
		if ( plugin_basename( $this->file ) !== $plugin_file ) {
			return $update;
		}
		$info = $this->get_info();
		if ( ! $info ) {
			return $update;
		}

		$result = array(
			'slug'         => self::SLUG,
			'version'      => $info['version'],
			'url'          => $info['url'],
			'tested'       => $info['tested'],
			'requires_php' => $info['requires_php'],
		);
		if ( '' !== $info['package'] ) {
			$result['package'] = $info['package'];
		}
		return $result;
	}

	/**
	 * Filter: plugins_api (the "View details" modal).
	 *
	 * @param false|object|array $result Result so far.
	 * @param string             $action API action.
	 * @param object             $args   Request arguments.
	 * @return false|object|array
	 */
	public function plugin_information( $result, $action, $args ) {
		if ( 'plugin_information' !== $action || ! isset( $args->slug ) || self::SLUG !== $args->slug ) {
			return $result;
		}
		$info = $this->get_info();
		if ( ! $info ) {
			return $result;
		}
		return (object) array(
			'name'          => '{{name}}',
			'slug'          => self::SLUG,
			'version'       => $info['version'],
			'requires'      => $info['requires'],
			'requires_php'  => $info['requires_php'],
			'tested'        => $info['tested'],
			'homepage'      => $info['url'],
			'download_link' => $info['package'],
			'sections'      => $info['sections'],
		);
	}

	/**
	 * Filter: http_request_args. Adds the license key only to requests for the update host.
	 *
	 * @param array  $args HTTP request arguments.
	 * @param string $url  Request URL.
	 * @return array
	 */
	public function add_license_header( $args, $url ) {
		$license = (string) get_option( self::OPTION_LICENSE, '' );
		if ( '' === $license || self::host() !== wp_parse_url( $url, PHP_URL_HOST ) || 0 !== strpos( $url, 'https://' ) ) {
			return $args;
		}
		$args['headers']                         = isset( $args['headers'] ) && is_array( $args['headers'] ) ? $args['headers'] : array();
		$args['headers'][ self::LICENSE_HEADER ] = $license;
		return $args;
	}

	/**
	 * Clears the cached update info.
	 */
	public static function clear_cache() {
		delete_transient( self::CACHE_KEY );
	}

	/**
	 * Fetches, validates and caches the update info.
	 *
	 * @return array|null Normalized info, or null when unavailable.
	 */
	public function get_info() {
		$cached = get_transient( self::CACHE_KEY );
		if ( is_array( $cached ) ) {
			return isset( $cached['version'] ) ? $cached : null;
		}

		$response = wp_remote_get(
			add_query_arg( 'installed', rawurlencode( $this->version ), self::INFO_URL ),
			array(
				'timeout' => 10,
				'headers' => array( 'Accept' => 'application/json' ),
			)
		);

		$info = null;
		if ( ! is_wp_error( $response ) && 200 === wp_remote_retrieve_response_code( $response ) ) {
			$info = self::normalize( json_decode( wp_remote_retrieve_body( $response ), true ) );
		}

		// Cache failures briefly so a down server isn't hit on every admin page load.
		set_transient( self::CACHE_KEY, $info ? $info : array( 'error' => true ), $info ? 12 * HOUR_IN_SECONDS : HOUR_IN_SECONDS );
		return $info;
	}

	/**
	 * Validates the server response.
	 *
	 * @param mixed $data Decoded JSON.
	 * @return array|null
	 */
	public static function normalize( $data ) {
		if ( ! is_array( $data ) || ! isset( $data['version'] ) || ! preg_match( '/^\d+(\.\d+){0,3}$/', (string) $data['version'] ) ) {
			return null;
		}

		$package = isset( $data['package'] ) ? (string) $data['package'] : '';
		if ( '' !== $package && ( 0 !== strpos( $package, 'https://' ) || self::host() !== wp_parse_url( $package, PHP_URL_HOST ) ) ) {
			$package = ''; // Only download from our own host over HTTPS.
		}

		$sections = array();
		if ( isset( $data['sections'] ) && is_array( $data['sections'] ) ) {
			foreach ( $data['sections'] as $key => $html ) {
				$sections[ sanitize_key( $key ) ] = wp_kses_post( (string) $html );
			}
		}

		return array(
			'version'      => (string) $data['version'],
			'package'      => $package,
			'url'          => isset( $data['url'] ) ? esc_url_raw( (string) $data['url'] ) : '',
			'requires'     => isset( $data['requires'] ) ? sanitize_text_field( (string) $data['requires'] ) : '',
			'requires_php' => isset( $data['requires_php'] ) ? sanitize_text_field( (string) $data['requires_php'] ) : '',
			'tested'       => isset( $data['tested'] ) ? sanitize_text_field( (string) $data['tested'] ) : '',
			'sections'     => $sections,
		);
	}
}
