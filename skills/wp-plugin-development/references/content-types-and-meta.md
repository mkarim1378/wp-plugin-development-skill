# Custom post types, taxonomies, and meta

Use this file when a plugin adds its own content model.

## Custom post types

```php
add_action( 'init', function () {
	register_post_type(
		'acme_review', // ≤ 20 chars, lowercase, prefixed
		array(
			'labels'          => array(
				'name'          => __( 'Reviews', 'acme-reviews' ),
				'singular_name' => __( 'Review', 'acme-reviews' ),
				'add_new_item'  => __( 'Add New Review', 'acme-reviews' ),
			),
			'public'          => true,
			'show_in_rest'    => true,          // block editor + REST
			'supports'        => array( 'title', 'editor', 'thumbnail', 'custom-fields', 'revisions' ),
			'has_archive'     => true,
			'rewrite'         => array( 'slug' => 'reviews' ),
			'menu_icon'       => 'dashicons-star-filled',
			'capability_type' => array( 'acme_review', 'acme_reviews' ),
			'map_meta_cap'    => true,
		)
	);
} );
```

Guardrails:

- Register on `init`, every request. Registering only on activation makes the type disappear.
- Without `show_in_rest => true` the post type uses the classic editor and is invisible to REST/Abilities consumers.
- `supports` must include `custom-fields` for registered meta to show up in the block editor's REST payloads.
- Changing `rewrite` slugs needs a rewrite flush (activation or a one-time upgrade step), never on every load.
- Custom `capability_type` requires `map_meta_cap => true` and granting the generated capabilities (`edit_acme_reviews`, `publish_acme_reviews`, ...) to roles on activation; otherwise nobody, including admins, can edit. Remove them on uninstall.
- Don't use reserved names (`post`, `page`, `attachment`, `revision`, `nav_menu_item`, `action`, `author`, `order`, `theme`).
- For private/internal data, use `'public' => false` with `'show_ui' => true` as needed, and still decide `show_in_rest` explicitly.

## Taxonomies

- `register_taxonomy( 'acme_review_topic', array( 'acme_review' ), $args )` on `init`; key ≤ 32 chars.
- Set `show_in_rest => true` and `hierarchical` deliberately; `show_admin_column => true` adds the column to the list table.
- Register the taxonomy before or in the same `init` callback as the post type if the CPT declares `taxonomies`.

## Meta

Register every meta key the plugin owns:

```php
register_post_meta(
	'acme_review',
	'_acme_reviews_rating', // leading underscore = protected (hidden from Custom Fields UI)
	array(
		'type'              => 'integer',
		'single'            => true,
		'default'           => 0,
		'sanitize_callback' => 'absint',
		'show_in_rest'      => true,
		'auth_callback'     => function ( $allowed, $meta_key, $post_id ) {
			return current_user_can( 'edit_post', $post_id );
		},
	)
);
```

- `show_in_rest` is required for the block editor (sidebars, Block Bindings via the `core/post-meta` source) and REST clients to read or write the key.
- Protected keys (leading `_`) need an `auth_callback` to be writable via REST.
- `type` `array` or `object` needs a schema: `'show_in_rest' => array( 'schema' => array( 'type' => 'array', 'items' => array( 'type' => 'string' ) ) )`.
- Use `register_term_meta()` and `register_meta( 'user', ... )` the same way.
- Meta queries on unindexed `meta_value` don't scale; if you filter or sort by a value on large sites, consider a taxonomy or a custom table (see `data-and-cron.md`).

## Editing UI

- In the block editor, prefer a `PluginDocumentSettingPanel` (from `@wordpress/editor`) bound to registered meta over classic meta boxes.
- Classic meta boxes (`add_meta_box()`) still work. In WP 7.1 the post editor is always iframed, even on screens with meta boxes, so test meta box JS/CSS against the iframed editor.
- Save meta box data on `save_post_{$post_type}` with a nonce check, `current_user_can( 'edit_post', $post_id )`, and an early return for autosaves (`wp_is_post_autosave()`) and revisions (`wp_is_post_revision()`).
- Real-time collaboration was not shipped in WP 7.0 or 7.1. Registering meta with `show_in_rest` is still the right default because the block editor, REST, and future collaboration features rely on it.

Upstream reference:

- https://developer.wordpress.org/plugins/post-types/
- https://developer.wordpress.org/plugins/taxonomies/
- https://developer.wordpress.org/reference/functions/register_meta/
