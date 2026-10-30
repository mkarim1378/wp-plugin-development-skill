# HPOS and order code

High-Performance Order Storage (HPOS) stores orders in `wc_orders`, `wc_orders_meta`, `wc_order_addresses`, and `wc_order_operational_data` instead of `wp_posts`/`wp_postmeta`. It is the default for new stores since WooCommerce 8.2. Stores may also run with "compatibility mode" (sync to posts) on or off; code must work in every combination.

## Declare compatibility

In the main plugin file:

```php
add_action( 'before_woocommerce_init', function () {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
	}
} );
```

From a file other than the main file, pass the plugin path (`'my-plugin/my-plugin.php'`) instead of `__FILE__`. Declare `false` if the plugin is known to be incompatible, so WooCommerce warns the merchant instead of silently breaking.

## Reading and writing orders

```php
$order = wc_get_order( $order_id );
if ( ! $order ) {
	return;
}

$tracking = $order->get_meta( '_acme_tracking_code' );
$order->update_meta_data( '_acme_tracking_code', sanitize_text_field( $code ) );
$order->add_order_note( __( 'Tracking code added.', 'acme' ) );
$order->save(); // persists meta and props; relatively expensive, call once
```

- Getters/setters for core data: `get_status()`, `get_total()`, `get_billing_email()`, `set_status()` (or `update_status( 'completed', $note )`, which saves).
- `$order->get_id()` — never assume it equals a post ID in SQL.
- Refunds are separate objects (`wc_create_refund()`, `$order->get_refunds()`).
- Use `wc_get_order_statuses()`; custom statuses register with `register_post_status()` (still required with HPOS) plus the `wc_order_statuses` filter.

## Querying

```php
$orders = wc_get_orders( array(
	'status'       => array( 'wc-processing', 'wc-on-hold' ),
	'limit'        => 50,
	'paged'        => 1,
	'date_created' => '>' . ( time() - DAY_IN_SECONDS ),
	'meta_query'   => array(
		array( 'key' => '_acme_synced', 'compare' => 'NOT EXISTS' ),
	),
	'return'       => 'ids',
) );
```

- Always set `limit` (default is the store's posts-per-page; `-1` loads everything into memory).
- Large exports/imports: batch with `paged` and process each batch in an Action Scheduler job.
- `OrderUtil::custom_orders_table_usage_is_enabled()` (`Automattic\WooCommerce\Utilities\OrderUtil`) tells you which storage is authoritative; only branch on it for raw SQL reporting, which should be rare.

## Admin screens

Order list columns exist on two screens:

```php
// Legacy (posts) screen.
add_filter( 'manage_edit-shop_order_columns', 'acme_add_column' );
add_action( 'manage_shop_order_posts_custom_column', function ( $column, $post_id ) {
	acme_render_column( $column, wc_get_order( $post_id ) );
}, 10, 2 );

// HPOS screen.
add_filter( 'manage_woocommerce_page_wc-orders_columns', 'acme_add_column' );
add_action( 'manage_woocommerce_page_wc-orders_custom_column', function ( $column, $order ) {
	acme_render_column( $column, $order );
}, 10, 2 );
```

Meta boxes:

```php
add_action( 'add_meta_boxes', function () {
	$screen = class_exists( \Automattic\WooCommerce\Utilities\OrderUtil::class )
		&& \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled()
		? wc_get_page_screen_id( 'shop-order' )
		: 'shop_order';
	add_meta_box( 'acme-tracking', __( 'Tracking', 'acme' ), 'acme_render_box', $screen, 'side' );
} );

function acme_render_box( $post_or_order ) {
	$order = $post_or_order instanceof WC_Order ? $post_or_order : wc_get_order( $post_or_order->ID );
	// ...
}
```

Save meta box data on `woocommerce_process_shop_order_meta` (fires for both screens) with a nonce and `current_user_can( 'edit_shop_orders' )`, and write via the order object.

Order edit URLs differ by storage: use `$order->get_edit_order_url()`, never build `post.php?post=` links.

## Audit checklist for existing plugins

Search for and replace:

- `get_post_meta(`, `update_post_meta(`, `delete_post_meta(`, `add_post_meta(` on order IDs
- `get_post( $order_id )`, `wp_update_post()` on orders, `get_post_type( $id ) === 'shop_order'` (use `OrderUtil::get_order_type( $id )`)
- `new WP_Query` / `get_posts()` with `'post_type' => 'shop_order'`
- SQL joining `wp_posts`/`wp_postmeta` for orders
- Hooks on `save_post_shop_order`, `manage_shop_order_posts_*` without the HPOS equivalents

Then test with HPOS on, compatibility mode off.

Upstream reference:

- https://developer.woocommerce.com/docs/features/high-performance-order-storage/recipe-book/
