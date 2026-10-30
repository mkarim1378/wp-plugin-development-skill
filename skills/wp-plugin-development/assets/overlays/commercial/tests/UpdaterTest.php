<?php
/**
 * Updater tests.
 *
 * @package {{namespace}}
 */

use {{namespace}}\Updater\Updater;

/**
 * Update checks with a mocked update server.
 */
class UpdaterTest extends WP_UnitTestCase {

	/**
	 * Body returned by the mocked server.
	 *
	 * @var array
	 */
	private $remote = array();

	/**
	 * Mocks HTTP and clears the cache.
	 */
	public function set_up() {
		parent::set_up();
		Updater::clear_cache();
		$this->remote = array(
			'version'  => '9.9.9',
			'package'  => 'https://' . Updater::host() . '/download/9.9.9',
			'tested'   => '{{tested}}',
			'sections' => array( 'changelog' => '<p>New</p><script>x</script>' ),
		);
		add_filter( 'pre_http_request', array( $this, 'mock_http' ), 10, 3 );
	}

	/**
	 * Removes the HTTP mock.
	 */
	public function tear_down() {
		remove_filter( 'pre_http_request', array( $this, 'mock_http' ), 10 );
		parent::tear_down();
	}

	/**
	 * Fake update server.
	 *
	 * @param false|array $preempt Preempt value.
	 * @param array       $args    Request args.
	 * @param string      $url     URL.
	 * @return array|false
	 */
	public function mock_http( $preempt, $args, $url ) {
		if ( Updater::host() !== wp_parse_url( $url, PHP_URL_HOST ) ) {
			return $preempt;
		}
		return array(
			'headers'  => array(),
			'body'     => wp_json_encode( $this->remote ),
			'response' => array(
				'code'    => 200,
				'message' => 'OK',
			),
			'cookies'  => array(),
		);
	}

	/**
	 * A newer version is offered for this plugin only.
	 */
	public function test_check_update_returns_remote_version() {
		$updater = new Updater( {{PREFIX}}_FILE, {{PREFIX}}_VERSION );
		$result  = $updater->check_update( false, array(), plugin_basename( {{PREFIX}}_FILE ) );
		$this->assertSame( '9.9.9', $result['version'] );
		$this->assertSame( $this->remote['package'], $result['package'] );

		$this->assertFalse( $updater->check_update( false, array(), 'other/other.php' ) );
	}

	/**
	 * Packages on foreign hosts are dropped and sections are sanitized.
	 */
	public function test_normalize_rejects_foreign_package_and_scripts() {
		$info = Updater::normalize(
			array(
				'version'  => '1.0.0',
				'package'  => 'https://evil.example/x.zip',
				'sections' => array( 'changelog' => '<p>ok</p><script>bad()</script>' ),
			)
		);
		$this->assertSame( '', $info['package'] );
		$this->assertStringNotContainsString( '<script>', $info['sections']['changelog'] );
		$this->assertNull( Updater::normalize( array( 'version' => 'latest' ) ) );
	}

	/**
	 * The license header is only sent to the update host over HTTPS.
	 */
	public function test_license_header_scope() {
		update_option( Updater::OPTION_LICENSE, 'KEY-123' );
		$updater = new Updater( {{PREFIX}}_FILE, {{PREFIX}}_VERSION );

		$args = $updater->add_license_header( array(), 'https://' . Updater::host() . '/x' );
		$this->assertSame( 'KEY-123', $args['headers'][ Updater::LICENSE_HEADER ] );

		$this->assertSame( array(), $updater->add_license_header( array(), 'https://other.example/x' ) );
		$this->assertSame( array(), $updater->add_license_header( array(), 'http://' . Updater::host() . '/x' ) );
	}
}
