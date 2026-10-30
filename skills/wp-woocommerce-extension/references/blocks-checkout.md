# Cart and Checkout blocks

New stores use the Cart and Checkout **blocks**, which run on the Store API (`/wp-json/wc/store/v1/`) and React. Classic hooks that print HTML into the checkout (`woocommerce_checkout_fields`, `woocommerce_review_order_before_payment`, `woocommerce_after_checkout_billing_form`, ...) don't run there. Support both unless the merchant only uses one.

## Declare compatibility

```php
add_action( 'before_woocommerce_init', function () {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', __FILE__, true );
	}
} );
```

## Additional checkout fields

Register on `woocommerce_init` (or later):

```php
add_action( 'woocommerce_init', function () {
	if ( ! function_exists( 'woocommerce_register_additional_checkout_field' ) ) {
		return;
	}
	woocommerce_register_additional_checkout_field( array(
		'id'       => 'acme/national-id', // namespace/field-name
		'label'    => __( 'National ID', 'acme' ),
		'location' => 'contact',           // contact | address | order
		'type'     => 'text',              // text | select | checkbox | date
		'required' => true,
	) );
} );
```

- `address` fields appear for both billing and shipping.
- `required` accepts a boolean (or a JSON Schema array for conditional rules).
- Validate per field with a `validate_callback` / `sanitize_callback` in the registration array, or globally with the `woocommerce_validate_additional_field` action (`WP_Error $errors, $field_key, $field_value`; add to `$errors`, don't return) and `woocommerce_sanitize_additional_field` (`$field_value, $field_key`; return the sanitized value).
- Read saved values (contact and order fields are stored in the `other` group, meta prefix `_wc_other/`; address fields in `billing`/`shipping`):

```php
use Automattic\WooCommerce\Blocks\Package;
use Automattic\WooCommerce\Blocks\Domain\Services\CheckoutFields;

$fields = Package::container()->get( CheckoutFields::class );
$value  = $fields->get_field_from_object( 'acme/national-id', $order, 'other' ); // 'billing' / 'shipping' for address fields
```

- Fields also show in the order admin, emails, and the customer's account automatically.
- For the classic shortcode checkout, keep a `woocommerce_checkout_fields` implementation or tell merchants only the block is supported.

## Extending Store API data

To expose plugin data to the Cart/Checkout blocks (for example tier savings):

```php
use Automattic\WooCommerce\StoreApi\Schemas\V1\CartItemSchema;

add_action( 'woocommerce_blocks_loaded', function () {
	woocommerce_store_api_register_endpoint_data( array(
		'endpoint'        => CartItemSchema::IDENTIFIER,
		'namespace'       => 'acme',
		'data_callback'   => function ( $cart_item ) {
			return array( 'tier_saving' => acme_tier_saving( $cart_item ) );
		},
		'schema_callback' => function () {
			return array( 'tier_saving' => array( 'type' => 'string', 'readonly' => true ) );
		},
		'schema_type'     => ARRAY_A,
	) );
} );
```

Render it in the blocks with a slot/fill or checkout filter from `@woocommerce/blocks-checkout` (built with `@woocommerce/dependency-extraction-webpack-plugin`, which maps `@woocommerce/*` imports to the `wc` globals; don't bundle those packages from npm).

## Payment method integration (block checkout)

Classic gateways need a block integration to appear in the Checkout block:

```php
use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

final class Acme_Blocks_Gateway extends AbstractPaymentMethodType {
	protected $name = 'acme_pay'; // must equal the gateway ID

	public function initialize() {
		$this->settings = get_option( 'woocommerce_acme_pay_settings', array() );
	}

	public function is_active() {
		return filter_var( $this->get_setting( 'enabled', false ), FILTER_VALIDATE_BOOLEAN );
	}

	public function get_payment_method_script_handles() {
		$asset = include ACME_DIR . 'build/blocks-gateway.asset.php';
		wp_register_script( 'acme-blocks-gateway', ACME_URL . 'build/blocks-gateway.js', $asset['dependencies'], $asset['version'], true );
		return array( 'acme-blocks-gateway' );
	}

	public function get_payment_method_data() {
		return array(
			'title'       => $this->get_setting( 'title' ),
			'description' => $this->get_setting( 'description' ),
			'supports'    => $this->get_supported_features(),
		);
	}
}

add_action( 'woocommerce_blocks_payment_method_type_registration', function ( $registry ) {
	$registry->register( new Acme_Blocks_Gateway() );
} );
```

```js
import { registerPaymentMethod } from '@woocommerce/blocks-registry';
import { getSetting } from '@woocommerce/settings';
import { decodeEntities } from '@wordpress/html-entities';

const settings = getSetting( 'acme_pay_data', {} );
const Content = () => decodeEntities( settings.description || '' );

registerPaymentMethod( {
	name: 'acme_pay',
	label: decodeEntities( settings.title || 'Acme Pay' ),
	content: <Content />,
	edit: <Content />,
	canMakePayment: () => true,
	ariaLabel: decodeEntities( settings.title || 'Acme Pay' ),
	supports: { features: settings.supports || [] },
} );
```

- Redirect-based gateways need nothing else: the block checkout calls the gateway's `process_payment()` and follows the returned redirect.
- Extra data from the payment form is sent with `onPaymentSetup` (from the `eventRegistration` prop) and arrives in `process_payment()` via `$_POST` / the Store API payment data.

Upstream reference:

- https://developer.woocommerce.com/docs/block-development/extensible-blocks/cart-and-checkout-blocks/additional-checkout-fields/
- https://developer.woocommerce.com/docs/block-development/extensible-blocks/cart-and-checkout-blocks/checkout-payment-methods/payment-method-integration/
