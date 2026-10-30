# Widgets

## Structure

```php
namespace Acme\Elementor\Widgets;

use Elementor\Controls_Manager;
use Elementor\Group_Control_Typography;
use Elementor\Widget_Base;

defined( 'ABSPATH' ) || exit;

class Callout extends Widget_Base {

	public function get_name() { return 'acme_callout'; }          // unique, prefixed
	public function get_title() { return esc_html__( 'Callout', 'acme' ); }
	public function get_icon() { return 'eicon-alert'; }
	public function get_categories() { return array( 'acme' ); }   // registered category
	public function get_keywords() { return array( 'callout', 'notice' ); }
	public function get_style_depends() { return array( 'acme-callout' ); }
	public function has_widget_inner_wrapper(): bool { return false; } // optimized markup; parent declares : bool
	protected function is_dynamic_content(): bool { return false; }    // output depends only on settings

	protected function register_controls() {
		$this->start_controls_section( 'content', array(
			'label' => esc_html__( 'Content', 'acme' ),
			'tab'   => Controls_Manager::TAB_CONTENT,
		) );
		$this->add_control( 'title', array(
			'label'   => esc_html__( 'Title', 'acme' ),
			'type'    => Controls_Manager::TEXT,
			'default' => esc_html__( 'Heads up', 'acme' ),
			'dynamic' => array( 'active' => true ),
		) );
		$this->add_control( 'link', array(
			'label' => esc_html__( 'Link', 'acme' ),
			'type'  => Controls_Manager::URL,
		) );
		$this->end_controls_section();

		$this->start_controls_section( 'style', array(
			'label' => esc_html__( 'Style', 'acme' ),
			'tab'   => Controls_Manager::TAB_STYLE,
		) );
		$this->add_control( 'title_color', array(
			'label'     => esc_html__( 'Title color', 'acme' ),
			'type'      => Controls_Manager::COLOR,
			'selectors' => array( '{{WRAPPER}} .acme-callout__title' => 'color: {{VALUE}};' ),
		) );
		$this->add_group_control( Group_Control_Typography::get_type(), array(
			'name'     => 'title_typography',
			'selector' => '{{WRAPPER}} .acme-callout__title',
		) );
		$this->add_responsive_control( 'padding', array(
			'label'      => esc_html__( 'Padding', 'acme' ),
			'type'       => Controls_Manager::DIMENSIONS,
			'size_units' => array( 'px', 'em', '%' ),
			'selectors'  => array( '{{WRAPPER}} .acme-callout' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};' ),
		) );
		$this->end_controls_section();
	}

	protected function render() {
		$settings = $this->get_settings_for_display();
		$this->add_render_attribute( 'wrapper', 'class', 'acme-callout' );
		$tag = 'div';
		if ( ! empty( $settings['link']['url'] ) ) {
			$this->add_link_attributes( 'wrapper', $settings['link'] ); // href, target, rel, custom attributes, escaped
			$tag = 'a';
		}
		?>
		<<?php echo esc_html( $tag ); ?> <?php $this->print_render_attribute_string( 'wrapper' ); ?>>
			<span class="acme-callout__title"><?php echo esc_html( $settings['title'] ); ?></span>
		</<?php echo esc_html( $tag ); ?>>
		<?php
	}

	protected function content_template() {
		?>
		<#
		var tag = settings.link && settings.link.url ? 'a' : 'div';
		view.addRenderAttribute( 'wrapper', 'class', 'acme-callout' );
		if ( 'a' === tag ) { view.addRenderAttribute( 'wrapper', 'href', elementor.helpers.sanitizeUrl( settings.link.url ) ); }
		#>
		<{{{ tag }}} {{{ view.getRenderAttributeString( 'wrapper' ) }}}>
			<span class="acme-callout__title">{{ settings.title }}</span>
		</{{{ tag }}}>
		<?php
	}
}
```

## Controls

- Types: `Controls_Manager::TEXT`, `TEXTAREA`, `WYSIWYG`, `NUMBER`, `SELECT`, `SELECT2`, `SWITCHER`, `CHOOSE`, `MEDIA`, `URL`, `COLOR`, `SLIDER`, `DIMENSIONS`, `ICONS`, `REPEATER` (with `new \Elementor\Repeater()`), `HEADING`, `DIVIDER`.
- Group controls: `Group_Control_Typography`, `Group_Control_Border`, `Group_Control_Box_Shadow`, `Group_Control_Background` via `add_group_control()`.
- `add_responsive_control()` for per-breakpoint values.
- `condition` / `conditions` to show controls conditionally.
- `'dynamic' => array( 'active' => true )` lets text/URL/media controls use dynamic tags.
- Style values go through `selectors` (Elementor generates CSS), not inline styles from `render()`.
- `SWITCHER` returns `'yes'` or `''`; compare with `'yes' === $settings['x']`.

## Render rules

- Read settings with `get_settings_for_display()` (resolves dynamic tags and globals).
- Escape at output: `esc_html()` for text, `esc_url()` for URLs, `esc_attr()` in attributes, `wp_kses_post()` for WYSIWYG.
- Attributes: build with `add_render_attribute()` and print with `print_render_attribute_string()` (escaped by Elementor).
- Media: `\Elementor\Group_Control_Image_Size::print_attachment_image_html( $settings )` or `wp_get_attachment_image()`; never print raw URLs into `src` without `esc_url()`.
- Repeaters: give each item's elements `elementor-repeater-item-{{ _id }}` to target per-item styles.
- Inline editing: `$this->add_inline_editing_attributes( 'title', 'none' )` and the matching `view.addInlineEditingAttributes` in the template.

## content_template()

- Underscore.js template: `<# #>` for logic, `{{ }}` escapes output, `{{{ }}}` prints raw. Use `{{{ }}}` only for values you built yourself (render attribute strings, sanitized markup).
- Keep it in sync with `render()`; if the widget can't be previewed in JS (server data needed), omit `content_template()` and Elementor will render via PHP.
- Sanitize URLs with `elementor.helpers.sanitizeUrl()` in templates.

## Frontend JS

- Register scripts on `wp_enqueue_scripts`; return their handles from `get_script_depends()`; add `elementor-frontend` as a dependency when using Elementor's JS API.
- Initialize per widget instance with `elementorFrontend.hooks.addAction( 'frontend/element_ready/acme_callout.default', function ( $scope ) { ... } )` inside a `elementor/frontend/init` event listener, or extend `elementorModules.frontend.handlers.Base` for richer handlers. Scope DOM queries to `$scope`.
