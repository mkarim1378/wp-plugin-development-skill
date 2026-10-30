# WooCommerce REST API

Two APIs exist:

| API | Namespace | Auth | Use for |
| --- | --- | --- | --- |
| WooCommerce REST API | `/wp-json/wc/v3/` | API keys (consumer key/secret over HTTPS), application passwords, or cookie + nonce | Back-office integrations: ERP, order import/export, inventory sync |
| Store API | `/wp-json/wc/store/v1/` | Public, cart token/nonce | Customer-facing cart/checkout (powers the blocks); see `blocks-checkout.md` |

## Extending wc/v3 responses

Add fields to order/product responses with the prepare filters (they receive the response, the object, and the request):

```php
add_filter( 'woocommerce_rest_prepare_shop_order_object', function ( $response, $order, $request ) {
	$response->data['acme_tracking'] = $order->get_meta( '_acme_tracking_code' );
	return $response;
}, 10, 3 );
```

Equivalent filters exist per type (`woocommerce_rest_prepare_product_object`, ...). For writable fields, use `woocommerce_rest_insert_shop_order_object` (after the object is created/updated) and validate input there, or register a schema-backed field with `register_rest_field()` on the post type for products.

## Custom endpoints in the wc namespace

Don't add routes under `wc/v3`. Register your own namespace (`acme/v1`) with `register_rest_route()` and proper `permission_callback` (for example `current_user_can( 'manage_woocommerce' )` or `edit_shop_orders`). See `wp-rest-api`.

## Consuming wc/v3 from another system

- Create keys under WooCommerce > Settings > Advanced > REST API with the minimum permission (read vs read/write) and a dedicated user.
- Paginate (`per_page` ≤ 100, `page`) and use `modified_after` for incremental syncs.
- Batch endpoints (`/orders/batch`) accept up to 100 items per request.
- Webhooks (WooCommerce > Settings > Advanced > Webhooks) push order/product events and are signed with `X-WC-Webhook-Signature` (base64 HMAC-SHA256 of the body with the webhook secret); verify with `hash_equals()`.
