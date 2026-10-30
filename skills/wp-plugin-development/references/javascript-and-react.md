# JavaScript and React in plugins

Use this file when a plugin adds editor UI, a React admin screen, or frontend JS. Blocks themselves: `wp-block-development`; `data-wp-*` interactivity: `wp-interactivity-api`.

Scaffold: `--block` adds a dynamic block (`assets-src/blocks/notice/`, built with a blocks manifest); `--admin-app` adds a React page under Tools backed by a REST endpoint (`assets-src/admin/`, `src/Rest/SettingsController.php`). Both use `@wordpress/scripts`.

## Build setup (@wordpress/scripts)

Keep JS sources out of PHP's `src/` (PSR-4). The scaffold uses `assets-src/` and builds into `build/`:

```json
"build:blocks": "wp-scripts build --source-path=assets-src/blocks --output-path=build/blocks --blocks-manifest",
"build:admin":  "wp-scripts build assets-src/admin/index.js --output-path=build/admin",
"lint:js":      "wp-scripts lint-js assets-src"
```

- Without entry arguments, wp-scripts discovers blocks by `block.json` under `--source-path` and builds their `editorScript`/`script`/`viewScript` files; `render` PHP files are copied.
- With an entry file, it builds just that file (`build/admin/index.js` + `index.asset.php`).
- `--blocks-manifest` writes `blocks-manifest.php` for `wp_register_block_types_from_metadata_collection()` (WP 6.8+), which registers every block with one file read.
- Every build emits `*.asset.php` with `dependencies` and `version`; always enqueue with them so `@wordpress/*` imports map to core script handles (`wp-element`, `wp-components`, ...) instead of being bundled.
- Ship `build/`, not `assets-src/` (`.distignore`), and keep sources in the public repo (WordPress.org guideline 4).

## Editor sidebar panel for post meta

```php
add_action( 'enqueue_block_editor_assets', function () {
	$asset = include ACME_DIR . 'build/editor/index.asset.php';
	wp_enqueue_script( 'acme-editor', ACME_URL . 'build/editor/index.js', $asset['dependencies'], $asset['version'], true );
	wp_set_script_translations( 'acme-editor', 'acme' );
} );
```

```js
import { registerPlugin } from '@wordpress/plugins';
import { PluginDocumentSettingPanel, store as editorStore } from '@wordpress/editor';
import { useSelect } from '@wordpress/data';
import { useEntityProp } from '@wordpress/core-data';
import { TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

function SubtitlePanel() {
	const postType = useSelect( ( select ) => select( editorStore ).getCurrentPostType(), [] );
	const [ meta, setMeta ] = useEntityProp( 'postType', postType, 'meta' );
	if ( postType !== 'post' ) {
		return null;
	}
	return (
		<PluginDocumentSettingPanel name="acme-subtitle" title={ __( 'Subtitle', 'acme' ) }>
			<TextControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Subtitle', 'acme' ) }
				value={ meta?._acme_subtitle ?? '' }
				onChange={ ( value ) => setMeta( { ...meta, _acme_subtitle: value } ) }
			/>
		</PluginDocumentSettingPanel>
	);
}

registerPlugin( 'acme-subtitle', { render: SubtitlePanel } );
```

- The meta key must be registered with `show_in_rest` (and `auth_callback` for `_`-prefixed keys), and the post type must support `custom-fields` (see `content-types-and-meta.md`). The value saves with the post; no extra request.
- Import `PluginDocumentSettingPanel`, `PluginSidebar`, `PluginPrePublishPanel` from `@wordpress/editor` (the `@wordpress/edit-post` exports are deprecated since WP 6.6).
- Editor UI scripts go on `enqueue_block_editor_assets`; they run in the parent frame, not in the iframed canvas.

## @wordpress/data

- Read with `useSelect( ( select ) => select( store ).getX(), [ deps ] )`; write with `useDispatch( store )`.
- Core stores: `core` (`@wordpress/core-data`: entities, `getEntityRecords`, `saveEntityRecord`), `core/editor`, `core/block-editor`, `core/notices` (`createSuccessNotice`, `createErrorNotice` for snackbars).
- Prefer core-data entities over hand-written fetch for posts, terms, users, and settings (`useEntityRecord( 'root', 'site' )` for registered settings with `show_in_rest`).
- Custom store for plugin state: `createReduxStore( 'acme/store', { reducer, actions, selectors, resolvers } )` + `register()`. Namespace the store name.

## REST from JavaScript (apiFetch)

```js
import apiFetch from '@wordpress/api-fetch';

const items = await apiFetch( { path: '/acme/v1/items?per_page=20' } );
await apiFetch( { path: '/acme/v1/items', method: 'POST', data: { title } } );
```

- Add `wp-api-fetch` as a dependency (the `.asset.php` does this). Core configures the root URL and the logged-in user's REST nonce (`X-WP-Nonce`) for it, so cookie auth works in wp-admin and on the frontend.
- The server still decides access: every route needs a real `permission_callback` (see `wp-rest-api`). The nonce only proves the request came from the user's browser session.
- Handle errors: apiFetch rejects with `{ code, message, data: { status } }`; show `message` to the user, not raw JSON.
- On cached frontend pages the embedded nonce can be stale; see `caching-compatibility.md`.

## React admin pages

- Mount into a `<div id="acme-app">` printed by an `add_menu_page()`/`add_management_page()` callback; enqueue the script only on that screen's hook suffix.
- `import { createRoot } from '@wordpress/element'` (React 18 API). Use `@wordpress/components` (`Card`, `Panel`, `TextControl`, `ToggleControl`, `SelectControl`, `Button`, `Notice`, `Spinner`, `Modal`) and enqueue the `wp-components` style.
- Pass `__next40pxDefaultSize` and `__nextHasNoMarginBottom` to form controls to opt into current sizing and avoid deprecation warnings.
- Lists of records: `@wordpress/dataviews` (`DataViews`, `DataForm`) gives core-style tables/grids with filters, sorting, and pagination (see `wp-7-features.md`). Check `build/*/index.asset.php`: if `wp-dataviews` isn't listed as a dependency, the package is bundled into your build; import its stylesheet as the package README describes.
- Server-provided initial data: `wp_add_inline_script( $handle, 'window.acmeApp = ' . wp_json_encode( $data ) . ';', 'before' )`. Never include secrets.
- Translations: `wp_set_script_translations( $handle, 'acme' )` and `__()` from `@wordpress/i18n`.

## Frontend JS

- Prefer script modules and the Interactivity API for block-driven frontend behavior (`viewScriptModule` in `block.json`).
- Plain scripts: enqueue conditionally with `strategy => defer` (see `assets-and-script-modules.md`).
- Don't ship React to the frontend for small interactions; it adds weight to every page that loads it.

## Testing

- Unit: `wp-scripts test-unit-js` (Jest) for pure functions and components (`@testing-library/react`).
- E2E: `wp-scripts test-playwright` with `@wordpress/e2e-test-utils-playwright` against wp-env: open the editor, use the panel, save, reload, assert the meta persisted.
- Lint: `wp-scripts lint-js` and `wp-scripts lint-style` in CI.
