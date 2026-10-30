# Action Scheduler and logging

## Action Scheduler

WooCommerce bundles Action Scheduler: a persistent queue with retries, logs, and an admin UI (Tools > Scheduled Actions). Prefer it over WP-Cron for anything that touches many orders/products or calls external APIs.

```php
// Enqueue one job per batch.
as_enqueue_async_action( 'acme_sync_batch', array( 'page' => 1 ), 'acme' );

// One-off in the future / recurring.
as_schedule_single_action( time() + HOUR_IN_SECONDS, 'acme_retry_order', array( 'order_id' => $order_id ), 'acme' );
if ( false === as_next_scheduled_action( 'acme_daily_report', array(), 'acme' ) ) {
	as_schedule_recurring_action( strtotime( 'tomorrow 03:00' ), DAY_IN_SECONDS, 'acme_daily_report', array(), 'acme' );
}

add_action( 'acme_sync_batch', function ( $page ) {
	$ids = wc_get_orders( array( 'limit' => 50, 'paged' => $page, 'return' => 'ids', 'status' => 'wc-completed' ) );
	foreach ( $ids as $id ) {
		acme_sync_order( $id ); // idempotent
	}
	if ( count( $ids ) === 50 ) {
		as_enqueue_async_action( 'acme_sync_batch', array( 'page' => $page + 1 ), 'acme' );
	}
} );
```

Rules:

- Always pass a group (plugin slug) so you can query and clean up: `as_unschedule_all_actions( '', array(), 'acme' )` on deactivation/uninstall.
- Arguments are stored as JSON and passed positionally to the callback: keep them small (IDs, page numbers), never objects.
- Jobs must be idempotent: a failed action can be retried manually, and timeouts may cause partial runs.
- Guard against duplicates for recurring/singleton jobs with `as_has_scheduled_action()` / `as_next_scheduled_action()`.
- Throwing an exception marks the action failed (visible in the UI); catch expected errors and log them instead.
- Outside WooCommerce, bundle Action Scheduler via Composer (`woocommerce/action-scheduler`) and load it early; the library handles multiple copies.

## Logging

```php
$logger = wc_get_logger();
$logger->info( 'Sync started', array( 'source' => 'acme' ) );
$logger->error(
	'Provider error',
	array(
		'source' => 'acme',
		'order'  => $order_id,
		'code'   => $code,
	)
);
```

- Levels: `emergency`, `alert`, `critical`, `error`, `warning`, `notice`, `info`, `debug`. Log `debug` only when a "Debug log" setting is on.
- Logs appear in WooCommerce > Status > Logs, grouped by `source`.
- Never log secrets, tokens, full API responses with personal data, or card data. Mask identifiers when possible.
- Add a "debug mode" setting for verbose logging; default off.
