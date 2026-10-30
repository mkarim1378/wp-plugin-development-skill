---
name: wp-woocommerce-extension
description: "Use when building or fixing WooCommerce extensions: HPOS-compatible order code (wc_get_order, order CRUD, order screens), products and product data fields, cart/price calculation (dynamic or tiered pricing), Cart/Checkout Blocks compatibility (additional checkout fields, Store API, payment method integrations), payment gateways (WC_Payment_Gateway, callbacks/webhooks, refunds), WooCommerce settings tabs and emails, Action Scheduler jobs, WC_Logger, the WooCommerce REST API, and testing with WooCommerce. Pairs with wp-plugin-development for general plugin guardrails."
compatibility: "Targets WordPress 7.0+ (PHP 7.4.0+) with WooCommerce 10.0+ (current: 11.x). Filesystem-based agent with bash + node. Some workflows require WP-CLI."
---

# WooCommerce extension development

Use together with `wp-plugin-development` (security, lifecycle, i18n, release). This skill adds WooCommerce-specific rules.

## When to use

- Any plugin that reads or writes orders, products, carts, or checkout.
- Payment gateways, shipping/pricing logic, order import/export, WooCommerce admin screens or emails.
- "Incompatible with HPOS" / "doesn't work with the Checkout block" reports.

## Inputs required

- Target WooCommerce version range (default: WC 10.0+, tested with the latest 11.x).
- Whether the store uses HPOS (default on new stores since WC 8.2) and the Cart/Checkout blocks (default on new stores) or classic shortcodes. Support both unless told otherwise.
- For gateways: provider API docs (request/verify endpoints, callback format, currency units).

## Procedure

### 0) Triage

1. `node skills/wp-project-triage/scripts/detect_wp_project.mjs` and `node skills/wp-plugin-development/scripts/check_plugin_basics.mjs <plugin-dir>`. The check script adds WooCommerce rules (post APIs on orders, missing HPOS declaration, missing `Requires Plugins`) when the plugin uses WooCommerce.
2. New extension: `node skills/wp-plugin-development/scripts/scaffold_plugin.mjs --slug <slug> --woocommerce` (adds HPOS/Blocks declarations, `Requires Plugins: woocommerce`, WC headers, an HPOS-safe order column example, and WooCommerce in wp-env/PHPUnit).

### 1) Route

| Task | Load |
| --- | --- |
| Anything touching orders (meta, queries, admin columns/meta boxes, import/export) | `references/hpos-and-orders.md` |
| Product fields, product types, cart item prices, tiered/dynamic pricing | `references/products-and-pricing.md` |
| Cart/Checkout blocks, checkout fields, Store API, block payment UI | `references/blocks-checkout.md` |
| Payment gateways, callbacks, refunds | `references/payment-gateways.md` (Iranian gateways: also `wp-persian-localization`) |
| Settings tabs, emails, admin notices in WooCommerce screens | `references/settings-and-emails.md` |
| Background jobs, logging | `references/action-scheduler-and-logging.md` |
| WooCommerce REST API (wc/v3), extending responses | `references/rest-api.md` |
| PHPUnit/E2E with WooCommerce | `references/testing.md` |

### 2) Non-negotiable guardrails

- Declare compatibility on `before_woocommerce_init` for `custom_order_tables` and `cart_checkout_blocks` — `true` only after verifying it.
- Orders are not posts: never use `get_post_meta()`, `update_post_meta()`, `WP_Query`/`get_posts()` with `shop_order`, or SQL on `wp_posts`/`wp_postmeta` for orders. Use `wc_get_order()`, `wc_get_orders()`, `$order->get_meta()` / `update_meta_data()` + `save()`.
- Keep `Requires Plugins: woocommerce` in the header and check `class_exists( 'WooCommerce' )` before booting WooCommerce code.
- Money: use `wc_get_price_decimals()`, `wc_format_decimal()`, `wc_price()` for display; never float-compare amounts without rounding to the store's decimals.
- Hook callbacks that change cart prices must be idempotent (they run several times per request).
- Payment callbacks verify with the provider server-side, check the amount and currency against the order, and are safe to receive twice.
- Use `wc_get_logger()` (source = plugin slug) instead of `error_log()`; never log card data, tokens, or full API keys.

## Verification

- With HPOS on **and** off (WooCommerce > Settings > Advanced > Features, compatibility mode toggled), create/edit/list orders; your data and columns appear in both.
- Checkout works with the Checkout block **and** the `[woocommerce_checkout]` shortcode, including your fields and payment method.
- No PHP notices in WooCommerce > Status > Logs (fatal-errors) or `debug.log`.
- PHPUnit with WooCommerce loaded passes (see `references/testing.md`).

## Failure modes / debugging

- "This plugin is incompatible with the enabled WooCommerce features": missing or `false` compatibility declaration, or declared from a file other than the main plugin file without passing the plugin path.
- Order meta "disappears" with HPOS: written with `update_post_meta()` or without `$order->save()`.
- Custom checkout field missing on the Checkout block: classic `woocommerce_checkout_fields` filter only affects the shortcode checkout; use the Additional Checkout Fields API.
- Gateway not listed in the Checkout block: no `AbstractPaymentMethodType` integration registered.
- Cart prices doubled or wrong: price hook not idempotent, or price set from an already-modified price.

## Escalation

- Canonical docs: https://developer.woocommerce.com/docs/ (HPOS recipe book, Cart/Checkout blocks, Store API). Don't invent hook names; search the WooCommerce source (`plugins/woocommerce/` in woocommerce/woocommerce) when unsure.
- Ask before changing data for existing orders in bulk (migrations, status changes); run them in batches via Action Scheduler.
