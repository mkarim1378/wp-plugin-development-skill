<?php
/**
 * Elementor integration.
 *
 * @package {{namespace}}
 */

namespace {{namespace}}\Elementor;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the widget category, widgets and assets once Elementor is ready.
 */
final class Integration {

	const MIN_ELEMENTOR = '{{elementor_min}}';
	const CATEGORY      = '{{slug}}';

	/**
	 * Hooks into Elementor, or shows a notice when it is missing or too old.
	 */
	public function register() {
		if ( ! did_action( 'elementor/loaded' ) ) {
			return; // Requires Plugins normally prevents this.
		}
		if ( ! defined( 'ELEMENTOR_VERSION' ) || ! version_compare( ELEMENTOR_VERSION, self::MIN_ELEMENTOR, '>=' ) ) {
			add_action( 'admin_notices', array( $this, 'notice_minimum_version' ) );
			return;
		}

		add_action( 'elementor/elements/categories_registered', array( $this, 'register_category' ) );
		add_action( 'elementor/widgets/register', array( $this, 'register_widgets' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'register_assets' ) );
	}

	/**
	 * Adds the widget category.
	 *
	 * @param \Elementor\Elements_Manager $elements_manager Elements manager.
	 */
	public function register_category( $elements_manager ) {
		$elements_manager->add_category(
			self::CATEGORY,
			array(
				'title' => esc_html__( '{{name}}', '{{slug}}' ),
				'icon'  => 'fa fa-plug',
			)
		);
	}

	/**
	 * Registers widgets.
	 *
	 * @param \Elementor\Widgets_Manager $widgets_manager Widgets manager.
	 */
	public function register_widgets( $widgets_manager ) {
		$widgets_manager->register( new Widgets\Callout() );
	}

	/**
	 * Registers (not enqueues) widget assets; Elementor enqueues them only where the widget is used.
	 */
	public function register_assets() {
		wp_register_style( '{{slug}}-callout', false, array(), {{PREFIX}}_VERSION );
		wp_add_inline_style( '{{slug}}-callout', '.{{slug}}-callout{display:block;padding:1em;border-inline-start:4px solid currentColor}' );
	}

	/**
	 * Admin notice for an outdated Elementor.
	 */
	public function notice_minimum_version() {
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return;
		}
		wp_admin_notice(
			sprintf(
				/* translators: %s: minimum Elementor version. */
				esc_html__( '{{name}} requires Elementor %s or newer.', '{{slug}}' ),
				esc_html( self::MIN_ELEMENTOR )
			),
			array( 'type' => 'warning' )
		);
	}
}
