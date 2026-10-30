<?php
/**
 * Example Elementor widget.
 *
 * @package {{namespace}}
 */

namespace {{namespace}}\Elementor\Widgets;

use Elementor\Controls_Manager;
use Elementor\Widget_Base;

defined( 'ABSPATH' ) || exit;

/**
 * Callout box: escaped render, live preview, optimized markup, cacheable output.
 */
class Callout extends Widget_Base {

	const ALLOWED_TAGS = array( 'h2', 'h3', 'h4', 'p', 'div', 'span' );

	/**
	 * Widget name (unique, prefixed).
	 *
	 * @return string
	 */
	public function get_name() {
		return '{{prefix}}_callout';
	}

	/**
	 * Panel title.
	 *
	 * @return string
	 */
	public function get_title() {
		return esc_html__( 'Callout', '{{slug}}' );
	}

	/**
	 * Panel icon.
	 *
	 * @return string
	 */
	public function get_icon() {
		return 'eicon-alert';
	}

	/**
	 * Panel categories.
	 *
	 * @return string[]
	 */
	public function get_categories() {
		return array( '{{slug}}' );
	}

	/**
	 * Search keywords.
	 *
	 * @return string[]
	 */
	public function get_keywords() {
		return array( 'callout', 'notice', 'box' );
	}

	/**
	 * Registered style handles this widget needs.
	 *
	 * @return string[]
	 */
	public function get_style_depends() {
		return array( '{{slug}}-callout' );
	}

	/**
	 * No .elementor-widget-container wrapper (optimized markup).
	 *
	 * @return bool
	 */
	public function has_widget_inner_wrapper(): bool {
		return false;
	}

	/**
	 * Output depends only on settings, so Elementor may cache it.
	 *
	 * @return bool
	 */
	protected function is_dynamic_content(): bool {
		return false;
	}

	/**
	 * Controls.
	 */
	protected function register_controls() {
		$this->start_controls_section(
			'content',
			array(
				'label' => esc_html__( 'Content', '{{slug}}' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'title',
			array(
				'label'   => esc_html__( 'Title', '{{slug}}' ),
				'type'    => Controls_Manager::TEXT,
				'default' => esc_html__( 'Heads up', '{{slug}}' ),
				'dynamic' => array( 'active' => true ),
			)
		);

		$this->add_control(
			'title_tag',
			array(
				'label'   => esc_html__( 'Title tag', '{{slug}}' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'h3',
				'options' => array_combine( self::ALLOWED_TAGS, self::ALLOWED_TAGS ),
			)
		);

		$this->add_control(
			'text',
			array(
				'label'   => esc_html__( 'Text', '{{slug}}' ),
				'type'    => Controls_Manager::WYSIWYG,
				'default' => '',
			)
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'style',
			array(
				'label' => esc_html__( 'Style', '{{slug}}' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'accent_color',
			array(
				'label'     => esc_html__( 'Accent color', '{{slug}}' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => array( '{{WRAPPER}} .{{slug}}-callout' => 'color: {{VALUE}};' ),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Frontend output. Every setting is untrusted.
	 */
	protected function render() {
		$settings = $this->get_settings_for_display();
		$tag      = in_array( $settings['title_tag'], self::ALLOWED_TAGS, true ) ? $settings['title_tag'] : 'h3';

		$this->add_render_attribute( 'wrapper', 'class', '{{slug}}-callout' );
		?>
		<div <?php $this->print_render_attribute_string( 'wrapper' ); ?>>
			<<?php echo esc_html( $tag ); ?> class="{{slug}}-callout__title"><?php echo esc_html( $settings['title'] ); ?></<?php echo esc_html( $tag ); ?>>
			<?php if ( '' !== $settings['text'] ) : ?>
				<div class="{{slug}}-callout__text"><?php echo wp_kses_post( $settings['text'] ); ?></div>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * Editor live preview (Underscore template): {{ }} escapes, {{{ }}} prints raw.
	 */
	protected function content_template() {
		?>
		<#
		var allowed = <?php echo wp_json_encode( self::ALLOWED_TAGS ); ?>;
		var tag = allowed.indexOf( settings.title_tag ) > -1 ? settings.title_tag : 'h3';
		#>
		<div class="{{slug}}-callout">
			<{{{ tag }}} class="{{slug}}-callout__title">{{ settings.title }}</{{{ tag }}}>
			<# if ( settings.text ) { #>
				<div class="{{slug}}-callout__text">{{{ settings.text }}}</div>
			<# } #>
		</div>
		<?php
	}
}
