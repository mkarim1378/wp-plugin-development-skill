# Integration and compatibility

## Main file headers

```php
/*
 * Plugin Name:  Acme Elementor Widgets
 * Requires Plugins: elementor
 * Elementor tested up to: 4.3.0
 * Elementor Pro tested up to: 4.3.0
 */
```

`Requires Plugins` blocks activation without Elementor; the "tested up to" headers let Elementor flag untested addons.

## Boot with checks

```php
add_action( 'plugins_loaded', function () {
	if ( ! did_action( 'elementor/loaded' ) ) {
		return; // Requires Plugins normally prevents this.
	}
	if ( ! version_compare( ELEMENTOR_VERSION, ACME_MIN_ELEMENTOR, '>=' ) ) {
		add_action( 'admin_notices', 'acme_notice_elementor_version' );
		return;
	}
	add_action( 'elementor/elements/categories_registered', 'acme_register_category' );
	add_action( 'elementor/widgets/register', 'acme_register_widgets' );
	add_action( 'wp_enqueue_scripts', 'acme_register_assets' );
} );

function acme_register_category( $elements_manager ) {
	$elements_manager->add_category( 'acme', array( 'title' => esc_html__( 'Acme', 'acme' ), 'icon' => 'fa fa-plug' ) );
}

function acme_register_widgets( $widgets_manager ) {
	$widgets_manager->register( new \Acme\Elementor\Widgets\Pricing_Table() );
}
```

- Elementor Pro detection: `defined( 'ELEMENTOR_PRO_VERSION' )`. Gate Pro-dependent features; never fatal without Pro.
- Unregister core widgets only if the user asks: `$widgets_manager->unregister( 'widget-name' )`.
- Editor-only assets (panel UI): enqueue on `elementor/editor/before_enqueue_scripts` / `elementor/editor/after_enqueue_styles`. Preview-iframe assets: widget dependencies (they load in the preview automatically).

## Deprecated APIs to replace

| Old | New |
| --- | --- |
| `elementor/widgets/widgets_registered` + `Plugin::instance()->widgets_manager->register_widget_type()` | `elementor/widgets/register` + `$widgets_manager->register()` |
| `_register_controls()` | `register_controls()` |
| `_content_template()` | `content_template()` |
| `Scheme_Color`/`Scheme_Typography` | Global colors/fonts (`global` arg on controls) |

Check Elementor's deprecation notices in the browser console and `debug.log` after each Elementor release.

## Elementor 4 (atomic editor) and markup

- Elementor 4 introduced atomic elements (Elements, Variables, Classes, Components). Classic `Widget_Base` widgets keep working and can be placed alongside atomic elements on the same page.
- Optimized markup removes wrapper elements. New widgets should return `false` from `has_widget_inner_wrapper()` (no `.elementor-widget-container` div). Don't depend on wrapper class names in CSS or JS; scope styles to your own class and `{{WRAPPER}}` selectors.
- Global colors and fonts: use the `global` argument on color/typography controls so your widgets follow the site's design system (v3 globals sync with v4 variables/classes when the site enables it).
- For atomic element extension APIs, follow Elementor's developer docs for the version you target; don't reverse-engineer internal classes.

## Performance

- Element caching: return `false` from `is_dynamic_content()` for widgets whose output depends only on their settings; return `true` (default) when output depends on user, cart, time, or query vars.
- Avoid heavy queries in `render()`; cache with transients keyed by settings hash, and invalidate when source content changes.
- Load scripts only through `get_script_depends()`; Elementor enqueues them only on pages using the widget.
