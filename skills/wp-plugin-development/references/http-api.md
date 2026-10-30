# Calling external services (HTTP API)

Use this file when a plugin talks to a remote API, downloads files, or sends webhooks.

## Basics

```php
function acme_reviews_fetch_remote( $product_id ) {
	$cache_key = 'acme_reviews_remote_' . absint( $product_id );
	$cached    = get_transient( $cache_key );
	if ( false !== $cached ) {
		return $cached;
	}

	$response = wp_remote_get(
		add_query_arg( 'product', absint( $product_id ), 'https://api.example.com/v1/reviews' ),
		array(
			'timeout' => 10,
			'headers' => array( 'Accept' => 'application/json' ),
		)
	);

	if ( is_wp_error( $response ) ) {
		return $response;
	}
	$code = wp_remote_retrieve_response_code( $response );
	if ( 200 !== $code ) {
		return new WP_Error( 'acme_reviews_http_' . $code, __( 'The review service returned an error.', 'acme-reviews' ) );
	}

	$data = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( ! is_array( $data ) ) {
		return new WP_Error( 'acme_reviews_bad_json', __( 'Unexpected response from the review service.', 'acme-reviews' ) );
	}

	set_transient( $cache_key, $data, HOUR_IN_SECONDS );
	return $data;
}
```

## Guardrails

- Use `wp_remote_get()` / `wp_remote_post()` / `wp_remote_request()`, never raw cURL or `file_get_contents()` on URLs. The HTTP API honours proxies, SSL settings, and test mocking.
- Always check `is_wp_error()` and the status code; never assume JSON decoded successfully.
- Set an explicit `timeout`. The default (5s) blocks the whole page load if the call is on the critical path.
- Don't call remote APIs on every frontend request. Cache the result (transient/object cache), refresh in cron, or call on explicit user action.
- Never disable TLS verification (`'sslverify' => false`) in shipped code.
- For URLs that come from users or other untrusted sources, use `wp_safe_remote_get()` / `wp_safe_remote_post()`; they reject localhost and private network targets (SSRF protection). `download_url()` is the safe way to fetch a file to a temp path for media sideloading.
- Treat remote data as untrusted input: validate, sanitize before storing, and escape on output.
- Handle rate limits and outages: respect `Retry-After`, back off, and show a clear admin notice instead of fatals.
- Store API credentials as non-autoloaded options or `wp-config.php` constants. Don't log them or expose them to JS.

## Consent and disclosure (WordPress.org)

- Guideline 7: no phoning home, tracking, or telemetry without explicit opt-in consent.
- Guideline 6: a plugin that relies on a third-party service must document the service, what is sent, and link to its terms and privacy policy in `readme.txt` (an "External services" section).
- Add the data flow to the privacy policy suggestion text (see `privacy.md`).

## Testing

Mock HTTP calls in PHPUnit with the `pre_http_request` filter: return an array shaped like a real response (`headers`, `body`, `response` => `code`/`message`) or a `WP_Error`, so tests never hit the network.

Upstream reference:

- https://developer.wordpress.org/plugins/http-api/
