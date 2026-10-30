<?php
/**
 * Elementor integration tests.
 *
 * @package {{namespace}}
 */

use {{namespace}}\Elementor\Widgets\Callout;

/**
 * Widget registration and escaping.
 */
class ElementorTest extends WP_UnitTestCase {

	/**
	 * Elementor is loaded in the test environment.
	 */
	public function test_elementor_loaded() {
		$this->assertGreaterThan( 0, did_action( 'elementor/loaded' ) );
	}

	/**
	 * The widget identifies itself and uses the plugin category.
	 */
	public function test_widget_metadata() {
		$widget = new Callout();
		$this->assertSame( '{{prefix}}_callout', $widget->get_name() );
		$this->assertSame( array( '{{slug}}' ), $widget->get_categories() );
		$this->assertFalse( $widget->has_widget_inner_wrapper() );
	}

	/**
	 * Settings are escaped and the tag is restricted to the allow list.
	 */
	public function test_render_escapes_settings() {
		$widget = new Callout(
			array(
				'id'       => 'abc1234',
				'elType'   => 'widget',
				'settings' => array(
					'title'     => '<img src=x onerror=alert(1)>',
					'title_tag' => 'script',
					'text'      => '<p>ok</p><script>bad()</script>',
				),
			),
			array()
		);

		ob_start();
		$widget->render_content();
		$html = ob_get_clean();

		$this->assertStringNotContainsString( '<img', $html );
		$this->assertStringNotContainsString( '<script', $html );
		$this->assertStringContainsString( '<h3 class="{{slug}}-callout__title">', $html );
		$this->assertStringContainsString( '<p>ok</p>', $html );
	}
}
