# Iranian payment gateways

Most Iranian gateways (Zarinpal and other PSP/aggregator gateways) use the same three-step redirect flow. Implement the gateway shell with `wp-woocommerce-extension` (`payment-gateways.md`, `blocks-checkout.md`); this file covers the Iranian specifics. Always check the provider's current docs and sandbox before coding; endpoints and codes change.

## The flow

1. **Request**: server → provider with merchant ID, amount (Rial), callback URL, description, optional mobile/email/order ID. Provider returns a token/authority.
2. **Redirect**: customer → provider's payment page with the token.
3. **Callback + verify**: provider → your callback URL with token and status; your server → provider "verify" call with merchant ID, the **same amount**, and the token. Only a successful verify means paid.

## Zarinpal v4 (worked example)

| Step | Detail |
| --- | --- |
| Request | `POST https://payment.zarinpal.com/pg/v4/payment/request.json` JSON: `merchant_id` (36 chars), `amount` (integer), `currency` (`IRR` or `IRT`, optional), `callback_url`, `description`, `metadata` (`mobile`, `email`, `order_id`) |
| Request success | `data.code === 100`, token in `data.authority` |
| Redirect | `https://payment.zarinpal.com/pg/StartPay/{authority}` |
| Callback | query `Authority` and `Status` (`OK` or `NOK`); call verify only for `OK` |
| Verify | `POST https://payment.zarinpal.com/pg/v4/payment/verify.json` JSON: `merchant_id`, `amount`, `authority` |
| Verify success | `data.code === 100` (verified now) or `101` (already verified earlier); `ref_id` is the bank reference, `card_pan` masked card |
| Sandbox | separate sandbox host; see Zarinpal docs "سرویس تست (sandbox)" |

The merchant server IP must be registered with Zarinpal.

```php
private function zarinpal_request( WC_Order $order ) {
	$amount   = $this->rial_amount( $order );
	$response = wp_remote_post( 'https://payment.zarinpal.com/pg/v4/payment/request.json', array(
		'timeout' => 15,
		'headers' => array( 'Content-Type' => 'application/json', 'Accept' => 'application/json' ),
		'body'    => wp_json_encode( array(
			'merchant_id'  => $this->get_option( 'merchant_id' ),
			'amount'       => $amount,
			'currency'     => 'IRR', // always send Rial; convert once in rial_amount()
			'callback_url' => add_query_arg( 'order_id', $order->get_id(), WC()->api_request_url( $this->id ) ),
			'description'  => sprintf( 'Order %s', $order->get_order_number() ),
			'metadata'     => array_filter( array(
				'mobile'   => Persian::normalize_mobile( $order->get_billing_phone() ),
				'email'    => $order->get_billing_email(),
				'order_id' => (string) $order->get_id(),
			) ),
		) ),
	) );
	if ( is_wp_error( $response ) ) {
		return $response;
	}
	$body = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( 100 !== (int) ( $body['data']['code'] ?? 0 ) || empty( $body['data']['authority'] ) ) {
		return new WP_Error( 'zarinpal_request', __( 'Payment request was rejected.', 'acme' ) );
	}
	$order->update_meta_data( '_acme_zp_authority', sanitize_text_field( $body['data']['authority'] ) );
	$order->update_meta_data( '_acme_zp_amount', $amount );
	$order->save();
	return 'https://payment.zarinpal.com/pg/StartPay/' . rawurlencode( $body['data']['authority'] );
}
```

In the callback, compare the `Authority` query value with the stored one (`hash_equals()`), return early for `NOK` (mark the order failed or leave it pending with a note), and verify with the **stored** amount. Treat `100` and `101` as paid, but only complete the order once.

## Rial and Toman

- WooCommerce supports both `IRR` (ریال) and `IRT` (تومان) store currencies. 1 Toman = 10 Rial.
- Convert explicitly in one function and store the requested Rial amount on the order; verify with that stored value:

```php
private function rial_amount( WC_Order $order ) {
	$total = (float) $order->get_total();
	return 'IRT' === $order->get_currency() ? (int) round( $total * 10 ) : (int) round( $total );
}
```

- Hide the gateway for other currencies (`is_available()`).
- Show the customer the amount in the store currency; show admins the Rial amount in order notes to match bank statements.

## Iranian-specific edge cases

- **User closes the bank page**: order stays pending. Let WooCommerce's hold-stock timeout cancel it; don't cancel immediately on `NOK` if the provider may still settle.
- **Late success after cancellation**: verify succeeds for an order already cancelled by timeout → set on-hold with a note for manual handling (stock may already be released).
- **Duplicate callbacks / page refresh**: idempotency via `is_paid()` and the stored reference; `101` from verify is not an error.
- **Amount tampering**: callback URLs carrying an amount must be ignored; always use the stored amount.
- **Reversal window**: some PSPs auto-refund if verify isn't called within a few minutes; call verify synchronously in the callback, not in a background job.
- **Logs**: log authority/ref_id and codes; never log merchant IDs in full or card data (`card_pan` is masked, keep it masked).
- **Multiple gateways**: aggregators may require separate merchant IDs per domain; validate settings and show clear errors.
