# Admin UI: menus, form handlers, notices, list screens

Use this file for wp-admin screens that are not plain Settings API pages (see `settings-api.md` for those).

## Menus

- `add_menu_page()` / `add_submenu_page()` / `add_options_page()` / `add_management_page()` on `admin_menu` (`network_admin_menu` for network screens).
- Each call returns a hook suffix. Use it to load code only on your screen:
  - `load-{$hook_suffix}` for screen setup (help tabs, screen options, handling GET actions before output).
  - `admin_enqueue_scripts` with `if ( $hook_suffix !== $my_hook ) return;` for assets.
- The capability argument hides the menu but doesn't protect anything else. Check the capability again in the render callback and in every handler.
- Prefer placing pages under an existing menu (Settings, Tools, or your CPT's menu) over a new top-level item. Don't add menu items to the admin bar or dashboard widgets without user value.

## Form handlers (`admin-post.php`)

For admin forms that are not Settings API forms, post to `admin-post.php`:

```php
// Form
?>
<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
	<input type="hidden" name="action" value="acme_reviews_import">
	<?php wp_nonce_field( 'acme_reviews_import' ); ?>
	<?php submit_button( __( 'Import', 'acme-reviews' ) ); ?>
</form>
<?php

// Handler
add_action( 'admin_post_acme_reviews_import', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You are not allowed to do this.', 'acme-reviews' ), 403 );
	}
	check_admin_referer( 'acme_reviews_import' );

	// ... work ...

	wp_safe_redirect( add_query_arg( 'acme-imported', '1', admin_url( 'tools.php?page=acme-reviews' ) ) );
	exit;
} );
```

- Always redirect after a successful POST (POST/redirect/GET), and always `exit` after `wp_safe_redirect()`.
- `admin_post_nopriv_{action}` handles logged-out submissions; treat it as public input.

## Admin notices

```php
add_action( 'admin_notices', function () {
	if ( empty( $_GET['acme-imported'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- display only
		return;
	}
	wp_admin_notice(
		esc_html__( 'Import finished.', 'acme-reviews' ),
		array( 'type' => 'success', 'dismissible' => true )
	);
} );
```

- `wp_admin_notice()` / `wp_get_admin_notice()` (WP 6.4+) build standard markup; types are `success`, `info`, `warning`, `error`.
- Show notices only to users who can act on them, only on relevant screens, and make persistent ones dismissible (store dismissal in user meta). Site-wide nag notices and upsells violate WordPress.org guideline 11.
- Notices from activation must be deferred (set a transient, show it on the next request).

## List screens

- For your own CPT, the core list table is free: customize columns with `manage_{$post_type}_posts_columns`, `manage_{$post_type}_posts_custom_column`, `manage_edit-{$post_type}_sortable_columns`, row actions with `post_row_actions`, and bulk actions with `bulk_actions-edit-{$post_type}` / `handle_bulk_actions-edit-{$post_type}`.
- For custom data, `WP_List_Table` still works but is marked private API; copy patterns from core and expect occasional breakage.
- For new React-based admin screens, `@wordpress/dataviews` (DataViews/DataForm) is the modern option; see `wp-7-features.md`.
- WP 7.1 changed row header markup in post list tables; don't depend on exact list table HTML in CSS/JS.

## Screen polish

- Wrap pages in `<div class="wrap">` with a single `<h1>`; use core classes (`form-table`, `regular-text`, `button-primary`, `notice`) so the UI follows the admin color scheme (WP 7.0's default "Modern" scheme included).
- Make admin pages keyboard-accessible: real `<label for>`, buttons instead of clickable `div`s, visible focus states.
- Add contextual help with `get_current_screen()->add_help_tab()` on `load-{$hook_suffix}`.

Upstream reference:

- https://developer.wordpress.org/plugins/administration-menus/
- https://developer.wordpress.org/reference/functions/wp_admin_notice/
