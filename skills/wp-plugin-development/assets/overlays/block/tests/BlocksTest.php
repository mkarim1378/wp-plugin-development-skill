<?php
/**
 * Block tests.
 *
 * @package {{namespace}}
 */

/**
 * The notice block registers from the build and escapes its output.
 */
class BlocksTest extends WP_UnitTestCase {

	/**
	 * Skips when assets were not built.
	 */
	public function set_up() {
		parent::set_up();
		if ( ! WP_Block_Type_Registry::get_instance()->is_registered( '{{slug}}/notice' ) ) {
			$this->markTestSkipped( 'Run npm run build before the PHP tests.' );
		}
	}

	/**
	 * Allowed formatting survives, scripts do not.
	 */
	public function test_render_sanitizes_message() {
		$html = render_block(
			array(
				'blockName'    => '{{slug}}/notice',
				'attrs'        => array( 'message' => '<strong>Hi</strong><script>alert(1)</script>' ),
				'innerBlocks'  => array(),
				'innerHTML'    => '',
				'innerContent' => array(),
			)
		);
		$this->assertStringContainsString( '<strong>Hi</strong>', $html );
		$this->assertStringNotContainsString( '<script', $html );
		$this->assertStringContainsString( '{{slug}}-notice', $html );
	}

	/**
	 * Empty message renders nothing.
	 */
	public function test_empty_message_renders_nothing() {
		$html = render_block(
			array(
				'blockName'    => '{{slug}}/notice',
				'attrs'        => array(),
				'innerBlocks'  => array(),
				'innerHTML'    => '',
				'innerContent' => array(),
			)
		);
		$this->assertSame( '', trim( $html ) );
	}
}
