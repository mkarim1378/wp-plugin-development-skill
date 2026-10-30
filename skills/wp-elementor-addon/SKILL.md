---
name: wp-elementor-addon
description: "Use when building or fixing Elementor addons: registering widgets (Elementor Widget_Base, elementor/widgets/register), controls and responsive/group controls, render() escaping and render attributes, content_template() live preview, widget categories, script/style dependencies, dynamic tags, Elementor/Elementor Pro version checks, optimized markup and element caching, compatibility with Elementor 4 atomic elements, and security of widget settings (stored XSS). Pairs with wp-plugin-development for general plugin guardrails."
compatibility: "Targets WordPress 7.0+ (PHP 7.4.0+) with Elementor 3.25+ (current: 4.x). Filesystem-based agent with bash + node. Some workflows require WP-CLI."
---

# Elementor addon development

## When to use

- Adding widgets, dynamic tags, or widget categories to Elementor.
- Fixing widgets that break after Elementor updates (markup changes, deprecated hooks, editor preview issues).
- Security reviews of Elementor addons.

## Inputs required

- Minimum Elementor version to support (default 3.25) and whether Elementor Pro features are used.
- Whether the widget's output depends on the current user/request (affects element caching).

## Procedure

1. New addon: `node skills/wp-plugin-development/scripts/scaffold_plugin.mjs --slug <slug> --elementor` (adds `Requires Plugins: elementor`, Elementor headers, compatibility checks, a widget category, an example widget with escaped render + `content_template()`, and Elementor in wp-env/PHPUnit).
2. Route:

| Task | Load |
| --- | --- |
| Bootstrapping, version checks, categories, Elementor 4 coexistence, markup | `references/integration-and-compat.md` |
| Widget class, controls, render, live preview, assets | `references/widgets.md` |
| Dynamic tags | `references/dynamic-tags.md` |
| Security review of widgets | `references/security.md` |

3. Run `node skills/wp-plugin-development/scripts/check_plugin_basics.mjs <plugin-dir>`.

## Non-negotiable guardrails

- Boot only after `did_action( 'elementor/loaded' )` and a `version_compare( ELEMENTOR_VERSION, MIN, '>=' )` check; otherwise show an admin notice and stay inert.
- Register widgets on `elementor/widgets/register` with `$widgets_manager->register( new My_Widget() )` (the old `widgets_registered` hook and `register_widget_type()` are deprecated).
- Every setting is untrusted input from anyone who can edit with Elementor: escape every value in `render()` and in `content_template()` (`{{ }}` escapes, `{{{ }}}` does not; use it only for strings the template built itself, or WYSIWYG previews as Elementor core does).
- Links from URL controls go through `$this->add_link_attributes()`; HTML from WYSIWYG goes through `wp_kses_post()`.
- Don't style or query `.elementor-widget-container`; with optimized markup it may not exist. Return `false` from `has_widget_inner_wrapper()` for new widgets.
- Match parent signatures exactly: `has_widget_inner_wrapper(): bool` (public) and `is_dynamic_content(): bool` (protected) declare return types; omitting `: bool` is a fatal error.
- Return `false` from `is_dynamic_content()` only when output never depends on the current user, request, or time (it allows Elementor to cache the element).
- Assets are registered on `wp_enqueue_scripts` and declared with `get_script_depends()` / `get_style_depends()`; never enqueue them globally.

## Verification

- Widget appears in its category, previews live in the editor (content_template) and renders the same on the frontend.
- No PHP notices with `WP_DEBUG`; no console errors in the editor.
- Works with Elementor's latest version and the minimum version you claim; page with both v3 widgets and atomic elements renders.
- Settings containing `"><script>alert(1)</script>` render as text in both editor preview and frontend.

## Failure modes / debugging

- Widget missing from the panel: registered on a deprecated hook, class not loaded before `elementor/widgets/register`, or `get_categories()` returns an unregistered category.
- Editor preview blank but frontend fine: JS error in `content_template()`; check the browser console.
- Styles not applied: selectors target `.elementor-widget-container`, or `selectors` placeholders mistyped (`{{WRAPPER}}`, `{{VALUE}}`).
- Scripts not loading: handle not registered before Elementor builds dependencies, or registered only in admin.

## Escalation

- Canonical docs: https://developers.elementor.com/docs/ (widgets, controls, dynamic tags, compatibility). For Elementor 4 atomic elements, follow Elementor's developer docs and release notes; third-party APIs for atomic elements are newer than v3 widget APIs, so confirm availability before building on them.
