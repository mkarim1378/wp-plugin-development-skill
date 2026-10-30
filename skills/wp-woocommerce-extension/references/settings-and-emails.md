# WooCommerce settings and emails

## Settings: a section under an existing tab

Simplest option for small extensions:

```php
add_filter( 'woocommerce_get_sections_products', function ( $sections ) {
	$sections['acme'] = __( 'Acme', 'acme' );
	return $sections;
} );

add_filter( 'woocommerce_get_settings_products', function ( $settings, $current_section ) {
	if ( 'acme' !== $current_section ) {
		return $settings;
	}
	return array(
		array( 'title' => __( 'Acme', 'acme' ), 'type' => 'title', 'id' => 'acme_options' ),
		array(
			'title'   => __( 'Enable tiers', 'acme' ),
			'id'      => 'acme_enable_tiers',
			'type'    => 'checkbox',
			'default' => 'no',
		),
		array( 'type' => 'sectionend', 'id' => 'acme_options' ),
	);
}, 10, 2 );
```

WooCommerce renders, saves (with its own nonce and `manage_woocommerce` check), and sanitizes these by type. Read with `get_option( 'acme_enable_tiers' ) === 'yes'`.

## Settings: a full tab

Extend `WC_Settings_Page` and return an instance from the `woocommerce_get_settings_pages` filter:

```php
add_filter( 'woocommerce_get_settings_pages', function ( $pages ) {
	$pages[] = new Acme_Settings_Page(); // class Acme_Settings_Page extends WC_Settings_Page { ... }
	return $pages;
} );
```

Set `$this->id` and `$this->label` in the constructor before calling `parent::__construct()`, and return the settings array from `get_settings_for_default_section()` (or `get_settings_for_{section}_section()` for extra sections).

Guardrails:

- Capability is `manage_woocommerce`, not `manage_options`, for WooCommerce screens.
- Use `wc_admin_url()`/`admin_url( 'admin.php?page=wc-settings&tab=...' )` for links.
- Put gateway and shipping method settings in their own classes (`WC_Payment_Gateway`, `WC_Shipping_Method`) instead of separate tabs.

## Emails

```php
add_filter( 'woocommerce_email_classes', function ( $emails ) {
	$emails['Acme_Email_Tracking'] = new Acme_Email_Tracking(); // extends WC_Email
	return $emails;
} );
```

In the class: set `id`, `title`, `description`, `template_html`, `template_plain`, `template_base`, `customer_email`, `placeholders`; implement `trigger( $order_id )` (set `$this->object`, `$this->recipient`, check `is_enabled()` and `get_recipient()`, then `send()`); and `get_content_html()` / `get_content_plain()` using `wc_get_template_html()`.

- Ship templates in `templates/emails/` and let themes override them (`template_base`).
- Trigger from a domain event (`do_action( 'acme_tracking_added', $order_id )` hooked to `trigger`), not from admin request handlers.
- Escape everything in templates; use `$email->get_additional_content()` for merchant-editable text.
- WooCommerce's email editor (block-based) is evolving; test emails in WooCommerce > Settings > Emails preview.

## Admin notices on WooCommerce screens

Use `wc_get_screen_ids()` to limit notices to WooCommerce screens; follow the general rules in `wp-plugin-development` (`references/admin-ui.md`).
