# Security guardrails (plugin work)

Use this file when making security fixes or when handling any input/output. To review a whole plugin, follow `security-audit.md` (it starts by listing every entry point with `scripts/list_entry_points.mjs`).

## Nonces + permissions

- Nonces help prevent CSRF, not authorization.
- Always pair nonces with capability checks (`current_user_can()` or a more specific capability).
- Nonces are tied to the user session and an action string; use a specific, prefixed action (`acme_reviews_delete_{$id}`), not one shared nonce for everything.
- Nonces are valid for up to 24 hours and can be reused within that window; they don't prevent replay of idempotent requests.
- For logged-out visitors, nonces are shared by everyone and are not a security control. Protect public forms with validation, rate limiting, and capability-free logic that is safe for anyone to trigger.

```php
// Form
wp_nonce_field( 'acme_reviews_save', 'acme_reviews_nonce' );

// Handler
if ( ! current_user_can( 'edit_post', $post_id ) ) {
	wp_die( esc_html__( 'You are not allowed to do this.', 'acme-reviews' ), 403 );
}
check_admin_referer( 'acme_reviews_save', 'acme_reviews_nonce' ); // dies on failure
```

Use meta capabilities with an object ID (`edit_post`, `delete_post`, `edit_user`, `edit_term`) when acting on one object, so ownership and status rules apply. Use primitive capabilities (`manage_options`, `edit_posts`) for screen-level access. Never check roles (`in_array( 'administrator', $user->roles )`) instead of capabilities.

Upstream reference:

- https://developer.wordpress.org/apis/security/nonces/

## Sanitization and escaping

Golden rule:

- sanitize/validate on input, escape on output.

Practical rules:

- never process the entire `$_POST` / `$_GET` array; read explicit keys
- use `wp_unslash()` before sanitizing when needed (WordPress adds slashes to all superglobals)
- use prepared statements for SQL; avoid interpolating user input into queries
- validate against an allow list when the value is one of a known set (`in_array( $value, $allowed, true )`)

Common sanitizers:

| Input | Function |
| --- | --- |
| Single-line text | `sanitize_text_field()` |
| Multi-line text | `sanitize_textarea_field()` |
| Integer / ID | `absint()`, `(int)` |
| Email | `sanitize_email()` + `is_email()` |
| URL to store | `sanitize_url()` (alias of `esc_url_raw()`) |
| Slug / key | `sanitize_key()`, `sanitize_title()` |
| File name | `sanitize_file_name()` |
| HTML class | `sanitize_html_class()` |
| Limited HTML | `wp_kses_post()`, `wp_kses( $html, $allowed )` |
| Hex color | `sanitize_hex_color()` |

```php
$title = isset( $_POST['title'] ) ? sanitize_text_field( wp_unslash( $_POST['title'] ) ) : '';
$ids   = isset( $_POST['ids'] ) ? array_map( 'absint', (array) wp_unslash( $_POST['ids'] ) ) : array();
```

## Output escaping contexts

Escape at output, using the function that matches the context:

* HTML text: `esc_html()`
* HTML attribute: `esc_attr()`
* URL: `esc_url()`
* textarea: `esc_textarea()`
* JavaScript strings: `esc_js()`

For JSON data, prefer `wp_json_encode()` and pass data through WordPress script APIs such as `wp_add_inline_script()` or `wp_localize_script()`.

For user-provided HTML, restrict allowed markup with `wp_kses_post()` or `wp_kses()` before output.

Also:

- Translated strings are untrusted output too: `esc_html__()`, `esc_attr__()`, `esc_html_e()`.
- Escape as late as possible, at the point of output, even for values you sanitized on input or read from the database.
- `printf()`/`sprintf()` don't escape; escape each argument.
- Never echo `$_SERVER['REQUEST_URI']`, `$_SERVER['PHP_SELF']`, or `add_query_arg()` results without `esc_url()`.

## AJAX handlers

* For `wp_ajax_*`, verify nonce and check capabilities.
* For `wp_ajax_nopriv_*`, assume unauthenticated attacker-controlled traffic.
* Return JSON with `wp_send_json_success()` or `wp_send_json_error()`.
* Do not expose private data from AJAX responses.

```php
add_action( 'wp_ajax_acme_reviews_approve', function () {
	check_ajax_referer( 'acme_reviews_approve', 'nonce' );
	$review_id = isset( $_POST['review_id'] ) ? absint( $_POST['review_id'] ) : 0;
	if ( ! $review_id || ! current_user_can( 'edit_post', $review_id ) ) {
		wp_send_json_error( array( 'message' => __( 'Not allowed.', 'acme-reviews' ) ), 403 );
	}
	// ... do the work ...
	wp_send_json_success();
} );
```

For new code, a REST route with a real `permission_callback` is usually clearer than admin-ajax (see `wp-rest-api`). Never use `'permission_callback' => '__return_true'` for routes that read private data or change state.

## SQL

- `$wpdb->prepare()` with `%d`, `%f`, `%s`, and `%i` (identifiers such as table/column names, WP 6.2+). Don't quote placeholders (`'%s'` is wrong).
- `LIKE`: `'%' . $wpdb->esc_like( $term ) . '%'` passed as a `%s` argument.
- `IN ()` lists: build one placeholder per value (`implode( ',', array_fill( 0, count( $ids ), '%d' ) )`).
- `ORDER BY` / direction can't be placeholders as values; map them through an allow list or use `%i` for the column.
- Prefer `$wpdb->insert()`, `update()`, `delete()` with format arrays, and core query classes (`WP_Query`, `get_posts()`) before raw SQL.

## Other common vulnerabilities

- **Redirects**: `wp_safe_redirect()` + `exit` for any user-influenced destination. `wp_redirect()` allows any host.
- **File uploads**: use `wp_handle_upload()` / `media_handle_upload()`; validate with `wp_check_filetype_and_ext()`; never trust the client MIME type or extension; never write uploads into the plugin directory.
- **File paths**: never build include/read paths from user input; use `validate_file()` and `realpath()` checks against an allowed base directory.
- **Object injection**: never `unserialize()` user-controlled data; store JSON (`wp_json_encode()` / `json_decode()`) for structured data.
- **Dangerous functions**: no `eval()`, `create_function()`, `extract()` on input, `assert()` with strings, or `shell_exec()`/`exec()` with input.
- **SSRF**: for user-supplied URLs use `wp_safe_remote_get()` / `wp_safe_remote_post()` (blocks local/private hosts) — see `http-api.md`.
- **Information disclosure**: don't expose debug output, stack traces, full paths, API keys, or other users' data in HTML, JSON, or JS globals. Don't localize secrets to the browser.
- **Privilege boundaries**: users with `unfiltered_html` may post scripts; everyone else may not. Don't let lower roles save settings that are later printed unescaped on admin screens (stored XSS against admins).
- **Secrets**: store API keys in options (non-autoloaded) or constants in `wp-config.php`; never hard-code them in the plugin. For AI providers in WP 7.0+, let the Connectors screen own the key (see `wp-7-features.md`).

Common review guidance:

- https://developer.wordpress.org/apis/security/
- https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/
