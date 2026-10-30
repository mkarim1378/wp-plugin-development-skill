# Caching compatibility (page caches, CDNs, object cache)

Use this file when plugin output is user-specific, time-sensitive, or uses nonces on the frontend, and whenever plugin data changes should appear on cached pages. Most production sites run a full-page cache (LiteSpeed Cache, WP Rocket, W3 Total Cache, WP Super Cache, host caches such as Varnish/Nginx FastCGI) and often a CDN (Cloudflare, ArvanCloud) in front.

## How page caches break plugins

A cached page is HTML generated once for one visitor and served to everyone until it expires or is purged.

| Symptom | Cause |
| --- | --- |
| Forms/AJAX fail with "-1" or 403 after some hours | A nonce printed into cached HTML expired (nonces live 12–24h) or belongs to another user |
| Visitor sees someone else's name, cart count, or "logged in" UI | User-specific output cached as public HTML |
| Changes in plugin data don't show up | Data lives outside posts (options, custom tables), so the cache isn't purged |
| Random/rotating content never changes; countdowns frozen | Time-dependent output cached |
| Geo/currency/language switching ignored | Page varies by cookie/header the cache doesn't vary on |
| Caching disabled site-wide after installing the plugin | Plugin sets a cookie or calls `session_start()` on every request |

Logged-in users usually bypass page caches, so these bugs often only appear for visitors and in production. Test as a logged-out visitor with the cache enabled.

## Rules for frontend output

1. **Render the page cache-safe; personalize in the browser.** Print a placeholder, then fetch user-specific data from a REST endpoint after load. Serve that endpoint with `nocache_headers()` (REST responses for logged-in users are not page-cached by default, but CDNs may cache GET responses: send `Cache-Control: no-store` for private data).
2. **Don't print nonces into cacheable HTML for logged-out visitors.** Logged-out nonces aren't a security control anyway; for public forms rely on validation and rate limiting. If a nonce is needed, fetch it via REST/AJAX on page load (`wp_create_nonce()` in an uncached endpoint), or use the cache plugin's ESI (LiteSpeed: register the action with `do_action( 'litespeed_nonce', 'acme_action' )` before creating the nonce).
3. **Never set cookies or start PHP sessions on normal page views.** Set them only on explicit actions (add to cart, login, submit). Many hosts and caches disable caching for responses with `Set-Cookie`.
4. **Time-sensitive pieces**: compute in JS from a server timestamp, or keep the page TTL short for that template.
5. **Vary deliberately**: if output depends on a cookie (currency, language), tell the cache (LiteSpeed: `litespeed_vary_cookies` filter) or move the variation to the client.

## Marking a response non-cacheable

Only for pages that truly can't be cached (checkout steps, account pages, one-time tokens):

```php
add_action( 'template_redirect', function () {
	if ( ! acme_is_private_page() ) {
		return;
	}
	if ( ! defined( 'DONOTCACHEPAGE' ) ) {
		define( 'DONOTCACHEPAGE', true ); // honored by WP Rocket, WP Super Cache, W3TC, and many others
	}
	do_action( 'litespeed_control_set_nocache', 'acme private page' ); // LiteSpeed Cache (no-op if not installed)
	nocache_headers();                                                 // browsers, proxies, CDNs
} );
```

Don't do this on every page "to be safe": it removes caching for the whole site and is a common reason plugins get uninstalled.

## Purging when plugin data changes

Caches purge posts automatically when they change through core APIs. Purge yourself when the page shows data stored elsewhere (options, custom tables, external APIs):

```php
function acme_purge_post_caches( $post_id ) {
	clean_post_cache( $post_id );                       // core object cache; many page caches also listen to this
	do_action( 'litespeed_purge_post', $post_id );      // LiteSpeed Cache
	if ( function_exists( 'rocket_clean_post' ) ) {
		rocket_clean_post( $post_id );                  // WP Rocket
	}
	if ( function_exists( 'w3tc_flush_post' ) ) {
		w3tc_flush_post( $post_id );                    // W3 Total Cache
	}
	if ( function_exists( 'wp_cache_post_change' ) ) {
		wp_cache_post_change( $post_id );               // WP Super Cache
	}
	do_action( 'acme_purge_post_caches', $post_id );    // let hosts/CDN integrations hook in
}
```

- Purge the narrowest scope that's correct (one post, not the whole site). Site-wide purges (`litespeed_purge_all`, `rocket_clean_domain()`) only after settings changes that affect every page.
- With LiteSpeed, add tags to pages showing your data (`do_action( 'litespeed_tag_add', 'acme_reviews' )`) and purge by tag (`do_action( 'litespeed_purge', 'acme_reviews' )`) instead of guessing affected URLs.
- CDN edge caches (Cloudflare, ArvanCloud) are purged by their own plugins/APIs; expose the `acme_purge_post_caches` action rather than calling CDN APIs yourself.
- Verify each third-party function in that plugin's current docs before relying on it, and always guard with `function_exists()`.

## Object cache (Redis, Memcached)

- With a persistent object cache, `wp_cache_*` data and transients live in memory and survive across requests; without one, `wp_cache_*` is per request. Code must be correct in both cases.
- Use a plugin-specific group: `wp_cache_set( $key, $value, 'acme', HOUR_IN_SECONDS )`. For data that must never be shared between requests, call `wp_cache_add_non_persistent_groups( array( 'acme_request' ) )`.
- Invalidate explicitly when the source changes; for many keys, use a "last changed" salt (`wp_cache_get_last_changed( 'acme' )` / `wp_cache_set_last_changed( 'acme' )`) in the key instead of deleting keys one by one.
- `wp_cache_flush_group( 'acme' )` exists since WP 6.1, but not every backend supports it: check `wp_cache_supports( 'flush_group' )` first.
- Store plain arrays/scalars, not objects with closures or resources.
- Multisite: groups are per-site unless registered as global (`wp_cache_add_global_groups()`).

## Static assets and browser cache

- Version every enqueued asset (build hash or plugin version) so caches and CDNs fetch new files after an update.
- Don't generate CSS/JS files on the fly with user-specific content; minification/combination plugins will cache and serve them to everyone.
- Asset optimization plugins (delay JS, defer, combine) may break inline scripts that run before your library loads: attach data with `wp_add_inline_script()` to your handle so it moves with the script, and initialize on `DOMContentLoaded` or from the script itself.

## WooCommerce and blocks

- Cart/Checkout blocks and the Mini-Cart fetch cart state through the Store API, which is cache-safe. Don't print cart totals into server-rendered HTML for visitors.
- Use WooCommerce's own session for per-visitor state; it only sets cookies once the visitor interacts with the cart.

## Testing

1. Install a page cache (LiteSpeed Cache on OpenLiteSpeed, or WP Rocket/WP Super Cache on any server) in a staging site.
2. Log out (or use a private window), load the page twice, and confirm the second response is a cache hit (for example `X-LiteSpeed-Cache: hit`, `cf-cache-status: HIT`, or the HTML comment the cache plugin appends).
3. Exercise every frontend form and AJAX action on the cached page, also after changing the nonce lifetime filter (`nonce_life`) to a few minutes to simulate stale pages.
4. Change plugin data and confirm the cached page updates (purge works).
5. Confirm no `Set-Cookie` header on plain page views.
