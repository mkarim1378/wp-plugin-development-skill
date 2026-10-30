# Payment gateways

## Skeleton

```php
add_filter( 'woocommerce_payment_gateways', function ( $gateways ) {
	$gateways[] = Acme_Pay_Gateway::class;
	return $gateways;
} );

class Acme_Pay_Gateway extends WC_Payment_Gateway {

	public function __construct() {
		$this->id                 = 'acme_pay';           // also the Blocks integration name
		$this->method_title       = __( 'Acme Pay', 'acme' );
		$this->method_description = __( 'Redirects customers to Acme Pay.', 'acme' );
		$this->has_fields         = false;
		$this->supports           = array( 'products', 'refunds' );

		$this->init_form_fields();
		$this->init_settings();
		$this->title       = $this->get_option( 'title' );
		$this->description = $this->get_option( 'description' );

		add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
		add_action( 'woocommerce_api_' . $this->id, array( $this, 'handle_callback' ) );
	}

	public function init_form_fields() {
		$this->form_fields = array(
			'enabled'     => array( 'title' => __( 'Enable', 'acme' ), 'type' => 'checkbox', 'default' => 'no' ),
			'title'       => array( 'title' => __( 'Title', 'acme' ), 'type' => 'text', 'default' => __( 'Acme Pay', 'acme' ) ),
			'description' => array( 'title' => __( 'Description', 'acme' ), 'type' => 'textarea', 'default' => '' ),
			'api_key'     => array( 'title' => __( 'API key', 'acme' ), 'type' => 'password' ),
			'sandbox'     => array( 'title' => __( 'Sandbox mode', 'acme' ), 'type' => 'checkbox', 'default' => 'yes' ),
		);
	}

	public function process_payment( $order_id ) {
		$order = wc_get_order( $order_id );

		$response = $this->api()->create_payment( array(
			'amount'       => $this->to_provider_amount( $order->get_total(), $order->get_currency() ),
			'order_id'     => $order->get_id(),
			'callback_url' => add_query_arg( 'order_id', $order->get_id(), WC()->api_request_url( $this->id ) ),
		) );

		if ( is_wp_error( $response ) ) {
			wc_add_notice( __( 'Payment could not be started. Please try again.', 'acme' ), 'error' );
			wc_get_logger()->error( $response->get_error_message(), array( 'source' => 'acme-pay' ) );
			return array( 'result' => 'failure' );
		}

		$order->update_meta_data( '_acme_pay_authority', $response['authority'] );
		$order->update_status( 'pending', __( 'Awaiting Acme Pay payment.', 'acme' ) ); // saves
		return array( 'result' => 'success', 'redirect' => $response['payment_url'] );
	}
}
```

`WC()->api_request_url( 'acme_pay' )` produces `https://store/?wc-api=acme_pay`, which fires `woocommerce_api_acme_pay`. Load the class on `plugins_loaded` (after WooCommerce) and only if `class_exists( 'WC_Payment_Gateway' )`.

## Callback / webhook handling (the part that gets plugins hacked)

```php
public function handle_callback() {
	$order_id = isset( $_GET['order_id'] ) ? absint( $_GET['order_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- provider callback, verified below
	$order    = $order_id ? wc_get_order( $order_id ) : false;
	if ( ! $order || $order->get_payment_method() !== $this->id ) {
		wp_die( 'Invalid order', '', array( 'response' => 400 ) );
	}

	// 1. Idempotency: a paid order is final. Providers retry callbacks; users refresh.
	if ( $order->is_paid() ) {
		wp_safe_redirect( $this->get_return_url( $order ) );
		exit;
	}

	// 2. Never trust query/body values: ask the provider server-to-server.
	$authority    = (string) $order->get_meta( '_acme_pay_authority' );
	$verification = $this->api()->verify( $authority, $this->to_provider_amount( $order->get_total(), $order->get_currency() ) );

	// 3. Check amount, currency and reference match this order.
	if ( is_wp_error( $verification ) || ! $verification['paid'] || (string) $verification['authority'] !== $authority ) {
		$order->update_status( 'failed', __( 'Acme Pay verification failed.', 'acme' ) );
		wc_add_notice( __( 'Payment was not completed.', 'acme' ), 'error' );
		wp_safe_redirect( wc_get_checkout_url() );
		exit;
	}

	// 4. Complete exactly once.
	$order->payment_complete( $verification['transaction_id'] ); // sets status, reduces stock, saves
	$order->add_order_note( sprintf( __( 'Acme Pay transaction %s.', 'acme' ), $verification['transaction_id'] ) );
	WC()->cart && WC()->cart->empty_cart();

	wp_safe_redirect( $this->get_return_url( $order ) );
	exit;
}
```

Rules:

- Verify server-side with the provider for every callback; signature-only webhooks must verify the signature with a constant-time compare (`hash_equals()`).
- Compare the verified amount with the order total in the provider's unit (cents, Rials) — mismatches are fraud or bugs, never "close enough".
- Make completion idempotent (`is_paid()`, or a stored transaction ID) and lock against concurrent callbacks for the same order if the provider sends both a redirect and a webhook (short-lived option lock with `add_option()`).
- The user may return without paying, cancel, or pay after the order was cancelled for being unpaid (`woocommerce_cancel_unpaid_orders` / hold stock). Handle "paid but order cancelled": mark it on-hold with a note for manual review instead of silently completing.
- Don't rely on the customer's session in callbacks; webhooks have no cookies.
- Log request/response metadata with `wc_get_logger()` but never secrets or full card data.

## Refunds

```php
public function process_refund( $order_id, $amount = null, $reason = '' ) {
	$order  = wc_get_order( $order_id );
	$result = $this->api()->refund( $order->get_transaction_id(), $this->to_provider_amount( $amount, $order->get_currency() ) );
	if ( is_wp_error( $result ) ) {
		return $result; // shown to the admin
	}
	$order->add_order_note( sprintf( __( 'Refunded %s via Acme Pay.', 'acme' ), wc_price( $amount ) ) );
	return true;
}
```

Requires `'refunds'` in `$supports`.

## Availability and settings

- Hide the gateway when it can't work: override `is_available()` (currency not supported, missing API key, order total limits).
- Secrets in settings use `type => 'password'`; never print them back into HTML attributes unmasked in other screens.
- Provide sandbox mode and show a clear admin notice when it is on.
- Block checkout support: see `blocks-checkout.md` (payment method integration).

Upstream reference:

- https://developer.woocommerce.com/docs/features/payments/payment-gateway-api/
