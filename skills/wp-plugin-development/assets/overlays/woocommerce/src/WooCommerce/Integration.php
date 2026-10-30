<?php
/**
 * WooCommerce integration.
 *
 * @package {{namespace}}
 */

namespace {{namespace}}\WooCommerce;

use WC_Order;

defined( 'ABSPATH' ) || exit;

/**
 * HPOS-safe example: stores a reference on orders and shows it in both order list screens.
 */
final class Integration {

	const META_REFERENCE = '_{{prefix}}_reference';
	const COLUMN         = '{{prefix}}_reference';

	/**
	 * Hooks into WooCommerce.
	 */
	public function register() {
		// Legacy (posts) orders screen.
		add_filter( 'manage_edit-shop_order_columns', array( $this, 'add_column' ) );
		add_action( 'manage_shop_order_posts_custom_column', array( $this, 'render_legacy_column' ), 10, 2 );

		// HPOS orders screen.
		add_filter( 'manage_woocommerce_page_wc-orders_columns', array( $this, 'add_column' ) );
		add_action( 'manage_woocommerce_page_wc-orders_custom_column', array( $this, 'render_column' ), 10, 2 );
	}

	/**
	 * Stores the reference through the order object (works with HPOS and legacy storage).
	 *
	 * @param WC_Order $order     Order.
	 * @param string   $reference Reference to store.
	 */
	public static function set_reference( WC_Order $order, $reference ) {
		$order->update_meta_data( self::META_REFERENCE, sanitize_text_field( $reference ) );
		$order->save();
	}

	/**
	 * Reads the stored reference.
	 *
	 * @param WC_Order $order Order.
	 * @return string
	 */
	public static function get_reference( WC_Order $order ) {
		return (string) $order->get_meta( self::META_REFERENCE );
	}

	/**
	 * Adds the column after the order status.
	 *
	 * @param array<string, string> $columns Columns.
	 * @return array<string, string>
	 */
	public function add_column( $columns ) {
		$result = array();
		foreach ( $columns as $key => $label ) {
			$result[ $key ] = $label;
			if ( 'order_status' === $key ) {
				$result[ self::COLUMN ] = __( 'Reference', '{{slug}}' );
			}
		}
		if ( ! isset( $result[ self::COLUMN ] ) ) {
			$result[ self::COLUMN ] = __( 'Reference', '{{slug}}' );
		}
		return $result;
	}

	/**
	 * Legacy screen passes a post ID.
	 *
	 * @param string $column  Column key.
	 * @param int    $post_id Order (post) ID.
	 */
	public function render_legacy_column( $column, $post_id ) {
		$order = wc_get_order( $post_id );
		if ( $order instanceof WC_Order ) {
			$this->render_column( $column, $order );
		}
	}

	/**
	 * HPOS screen passes the order object.
	 *
	 * @param string   $column Column key.
	 * @param WC_Order $order  Order.
	 */
	public function render_column( $column, $order ) {
		if ( self::COLUMN !== $column || ! $order instanceof WC_Order ) {
			return;
		}
		$reference = self::get_reference( $order );
		echo '' !== $reference ? esc_html( $reference ) : '&mdash;';
	}
}
