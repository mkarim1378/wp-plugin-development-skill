# Products and pricing

## Product data fields (admin)

```php
add_action( 'woocommerce_product_options_pricing', function () {
	woocommerce_wp_text_input( array(
		'id'                => '_acme_min_qty',
		'label'             => __( 'Minimum quantity', 'acme' ),
		'type'              => 'number',
		'custom_attributes' => array( 'min' => '1', 'step' => '1' ),
		'desc_tip'          => true,
		'description'       => __( 'Customers must buy at least this many.', 'acme' ),
	) );
} );

add_action( 'woocommerce_admin_process_product_object', function ( WC_Product $product ) {
	// Nonce and capability are verified by WooCommerce for this save flow.
	if ( isset( $_POST['_acme_min_qty'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$product->update_meta_data( '_acme_min_qty', absint( wp_unslash( $_POST['_acme_min_qty'] ) ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
	}
} );
```

- Save through the product object (`woocommerce_admin_process_product_object`); WooCommerce calls `save()` afterwards.
- Variations: `woocommerce_product_after_variable_attributes` (render, uses `$loop` index in field names) and `woocommerce_admin_process_variation_object` (save).
- Read with `$product->get_meta( '_acme_min_qty' )`. Products are still posts, but prefer CRUD for cache and lookup-table consistency (`wc_product_meta_lookup`).
- Product tabs: `woocommerce_product_data_tabs` + `woocommerce_product_data_panels`.
- The new product editor (block-based) is opt-in and evolving; check the WooCommerce docs before extending it.

## Cart item prices (dynamic and tiered pricing)

```php
add_action( 'woocommerce_before_calculate_totals', function ( WC_Cart $cart ) {
	if ( is_admin() && ! wp_doing_ajax() ) {
		return;
	}

	foreach ( $cart->get_cart() as $item ) {
		$product = $item['data'];
		$base    = (float) wc_get_product( $product->get_id() )->get_price( 'edit' ); // from a fresh object, not the modified one
		$price   = acme_tier_price( $base, (int) $item['quantity'], $product );
		$product->set_price( $price );
	}
}, 20 );
```

Rules:

- This hook runs several times per request (cart page, mini cart, Store API). Compute from the original price every time; never multiply the current (possibly already modified) price.
- Tiers that depend on total quantity of a product across variations: sum quantities first, then set prices.
- The Cart/Checkout blocks use the Store API, which runs the same totals calculation, so this works there too. Don't rely on `is_cart()`/`is_checkout()` inside this hook.
- Show the discount in the product page and cart: filter `woocommerce_get_price_html` (product display) and `woocommerce_cart_item_price` (classic cart). For the Cart block, extend Store API data (see `blocks-checkout.md`) instead of filtering HTML.
- Taxes: work with prices as entered (`get_price( 'edit' )`), let WooCommerce apply tax settings; use `wc_get_price_to_display()` for display.
- Rounding: round tier prices with `wc_get_price_decimals()`.
- Fees (surcharges/discounts not tied to items): `woocommerce_cart_calculate_fees` with `$cart->add_fee()`. Coupons are better for discounts that should show as discounts.

## Quantity rules

- Validate on add to cart: `woocommerce_add_to_cart_validation` (return `false` + `wc_add_notice()`).
- Validate on update: `woocommerce_update_cart_validation`.
- Default/min/max input values: `woocommerce_quantity_input_args` (classic). For the Store API (Cart/Checkout/Mini-Cart blocks), use the `woocommerce_store_api_product_quantity_{minimum|maximum|multiple_of|editable}` filters (`$value, $product, $cart_item`), with the same values as the classic rules.
- WC 11.2+: `woocommerce_store_api_cart_item_quantity_validation` adds custom rejections after the numeric checks; it can't loosen min/max/multiple-of.

## Product queries

- `wc_get_products( array( 'limit' => 20, 'status' => 'publish', 'stock_status' => 'instock' ) )`; always set `limit`.
- Custom query vars: `woocommerce_product_data_store_cpt_get_products_query`.

Upstream reference:

- https://developer.woocommerce.com/docs/
