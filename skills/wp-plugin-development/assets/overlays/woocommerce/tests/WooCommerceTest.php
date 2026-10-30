<?php
/**
 * WooCommerce integration tests.
 *
 * @package {{namespace}}
 */

use {{namespace}}\WooCommerce\Integration;

/**
 * Order data must round-trip through the order object on both storages.
 */
class WooCommerceTest extends WP_UnitTestCase {

	/**
	 * Data provider: HPOS on and off.
	 *
	 * @return array<string, array{string}>
	 */
	public function storage_provider() {
		return array(
			'hpos'   => array( 'yes' ),
			'legacy' => array( 'no' ),
		);
	}

	/**
	 * The reference is stored and read through order CRUD.
	 *
	 * @dataProvider storage_provider
	 *
	 * @param string $hpos Value for woocommerce_custom_orders_table_enabled.
	 */
	public function test_reference_round_trip( $hpos ) {
		update_option( 'woocommerce_custom_orders_table_enabled', $hpos );

		$order = wc_create_order();
		Integration::set_reference( $order, '<b>REF-1</b>' );

		$reloaded = wc_get_order( $order->get_id() );
		$this->assertSame( 'REF-1', Integration::get_reference( $reloaded ) );
	}

	/**
	 * The column renders escaped output.
	 */
	public function test_column_renders_reference() {
		$order = wc_create_order();
		Integration::set_reference( $order, 'REF-2' );

		ob_start();
		( new Integration() )->render_column( Integration::COLUMN, $order );
		$this->assertSame( 'REF-2', ob_get_clean() );
	}
}
