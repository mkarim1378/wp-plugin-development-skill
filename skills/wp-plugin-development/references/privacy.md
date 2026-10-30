# Privacy: personal data export/erasure and policy text

Use this file when a plugin stores data about people (users, customers, commenters, form submissions, logs with IPs/emails) or sends data to third parties.

## Privacy policy suggestion text

```php
add_action( 'admin_init', function () {
	if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
		return;
	}
	wp_add_privacy_policy_content(
		__( 'Acme Reviews', 'acme-reviews' ),
		wp_kses_post( wpautop( __( 'When you submit a review we store your name, email address and the review text. ...', 'acme-reviews' ), false ) )
	);
} );
```

Describe what is collected, why, how long it is kept, and which third parties receive it.

## Personal data exporter

```php
add_filter( 'wp_privacy_personal_data_exporters', function ( $exporters ) {
	$exporters['acme-reviews'] = array(
		'exporter_friendly_name' => __( 'Acme Reviews', 'acme-reviews' ),
		'callback'               => 'acme_reviews_export_personal_data',
	);
	return $exporters;
} );

function acme_reviews_export_personal_data( $email_address, $page = 1 ) {
	$per_page = 100;
	$reviews  = acme_reviews_get_by_email( $email_address, $per_page, $page ); // your query
	$items    = array();

	foreach ( $reviews as $review ) {
		$items[] = array(
			'group_id'    => 'acme-reviews',
			'group_label' => __( 'Reviews', 'acme-reviews' ),
			'item_id'     => 'acme-review-' . $review->id,
			'data'        => array(
				array( 'name' => __( 'Review', 'acme-reviews' ), 'value' => $review->content ),
				array( 'name' => __( 'Date', 'acme-reviews' ), 'value' => $review->created_at ),
			),
		);
	}

	return array(
		'data' => $items,
		'done' => count( $reviews ) < $per_page,
	);
}
```

## Personal data eraser

Register with `wp_privacy_personal_data_erasers` (`eraser_friendly_name`, `callback`). The callback receives `( $email_address, $page )` and returns:

```php
return array(
	'items_removed'  => $removed,   // bool
	'items_retained' => $retained,  // bool, e.g. data kept for legal reasons
	'messages'       => $messages,  // why items were retained
	'done'           => $done,
);
```

Anonymize (`wp_privacy_anonymize_data()`, `wp_privacy_anonymize_ip()`) instead of deleting when records must be kept (orders, audit logs).

## Guardrails

- Page through results (both callbacks are called repeatedly until `done`); never load everything at once.
- Match on email address, and also on the user ID when the email belongs to a registered user.
- Don't collect more than the feature needs; set retention periods and purge old data in cron.
- Don't send personal data to external services without consent and disclosure (see `http-api.md`).
- WP 7.1 runs `_wp_personal_data_cleanup_requests()` on cron; don't rely on export/erase requests lingering indefinitely.

Upstream reference:

- https://developer.wordpress.org/plugins/privacy/
