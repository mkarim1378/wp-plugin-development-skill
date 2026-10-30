# Testing with WooCommerce

## Environment

`.wp-env.json` (the scaffold's `--woocommerce` option writes this):

```json
{
	"phpVersion": "7.4",
	"plugins": [ ".", "https://downloads.wordpress.org/plugin/woocommerce.latest-stable.zip" ]
}
```

Pin a WooCommerce version for reproducible CI (`woocommerce.11.2.1.zip`) and test the minimum supported version in a second job.

## PHPUnit bootstrap

Load WooCommerce before your plugin and install its tables:

```php
tests_add_filter( 'muplugins_loaded', static function () {
	require WP_PLUGIN_DIR . '/woocommerce/woocommerce.php';
	require dirname( __DIR__ ) . '/acme.php';
} );

tests_add_filter( 'setup_theme', static function () {
	WC_Install::install();
	// Use HPOS tables in tests; toggle in specific tests to cover both storages.
	update_option( 'woocommerce_custom_orders_table_enabled', 'yes' );
} );
```

## Test data

```php
$product = new WC_Product_Simple();
$product->set_regular_price( '100' );
$product->save();

$order = wc_create_order();
$order->add_product( $product, 3 );
$order->calculate_totals();
$order->save();
```

- Cart tests: `WC()->cart->empty_cart(); WC()->cart->add_to_cart( $product->get_id(), 5 ); WC()->cart->calculate_totals();` then assert item prices.
- Gateway callbacks: mock the provider with `pre_http_request` and call `handle_callback()` twice to prove idempotency.
- Cover both storages for order code: run critical tests with `woocommerce_custom_orders_table_enabled` set to `yes` and `no` (and sync off).

## E2E

- `@woocommerce/e2e-utils-playwright` (if available for your WC version) or plain Playwright against wp-env.
- Test the Checkout block and the shortcode checkout separately; they are different code paths.
