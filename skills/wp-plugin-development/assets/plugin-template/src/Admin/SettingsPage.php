<?php
/**
 * Settings screen.
 *
 * @package {{namespace}}
 */

namespace {{namespace}}\Admin;

use {{namespace}}\Installer;
use {{namespace}}\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Settings > {{name}}, built on the Settings API.
 */
final class SettingsPage {

	const PAGE  = '{{slug}}';
	const GROUP = '{{prefix}}';

	/**
	 * Hooks the page into WordPress.
	 */
	public function register() {
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( {{PREFIX}}_FILE ), array( $this, 'action_links' ) );
	}

	/**
	 * Registers the option, section and fields.
	 */
	public function register_settings() {
		register_setting(
			self::GROUP,
			Installer::OPTION_SETTINGS,
			array(
				'type'              => 'object',
				'default'           => Settings::defaults(),
				'sanitize_callback' => array( Settings::class, 'sanitize' ),
			)
		);

		add_settings_section( '{{prefix}}_general', __( 'General', '{{slug}}' ), '__return_false', self::PAGE );

		add_settings_field(
			'{{prefix}}_enabled',
			__( 'Enable', '{{slug}}' ),
			array( $this, 'render_enabled_field' ),
			self::PAGE,
			'{{prefix}}_general',
			array( 'label_for' => '{{prefix}}_enabled' )
		);

		add_settings_field(
			'{{prefix}}_title',
			__( 'Title', '{{slug}}' ),
			array( $this, 'render_title_field' ),
			self::PAGE,
			'{{prefix}}_general',
			array( 'label_for' => '{{prefix}}_title' )
		);
{{#commercial}}

		register_setting(
			self::GROUP,
			'{{prefix}}_license_key',
			array(
				'type'              => 'string',
				'default'           => '',
				'sanitize_callback' => 'sanitize_text_field',
			)
		);

		add_settings_field(
			'{{prefix}}_license',
			__( 'License key', '{{slug}}' ),
			array( $this, 'render_license_field' ),
			self::PAGE,
			'{{prefix}}_general',
			array( 'label_for' => '{{prefix}}_license' )
		);
{{/commercial}}
	}

	/**
	 * Adds the page under Settings.
	 */
	public function add_page() {
		add_options_page(
			__( '{{name}}', '{{slug}}' ),
			__( '{{name}}', '{{slug}}' ),
			'manage_options',
			self::PAGE,
			array( $this, 'render_page' )
		);
	}

	/**
	 * Adds a Settings link on the Plugins screen.
	 *
	 * @param string[] $links Existing links.
	 * @return string[]
	 */
	public function action_links( $links ) {
		$url = admin_url( 'options-general.php?page=' . self::PAGE );
		array_unshift( $links, sprintf( '<a href="%s">%s</a>', esc_url( $url ), esc_html__( 'Settings', '{{slug}}' ) ) );
		return $links;
	}

	/**
	 * Renders the settings page.
	 */
	public function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<form action="options.php" method="post">
				<?php
				settings_fields( self::GROUP );
				do_settings_sections( self::PAGE );
				submit_button();
				?>
			</form>
		</div>
		<?php
	}

	/**
	 * Checkbox field.
	 */
	public function render_enabled_field() {
		$settings = Settings::get();
		printf(
			'<input type="checkbox" id="%1$s" name="%2$s[enabled]" value="1" %3$s>',
			esc_attr( '{{prefix}}_enabled' ),
			esc_attr( Installer::OPTION_SETTINGS ),
			checked( $settings['enabled'], true, false )
		);
	}

	/**
	 * Text field.
	 */
	public function render_title_field() {
		$settings = Settings::get();
		printf(
			'<input type="text" class="regular-text" id="%1$s" name="%2$s[title]" value="%3$s">',
			esc_attr( '{{prefix}}_title' ),
			esc_attr( Installer::OPTION_SETTINGS ),
			esc_attr( $settings['title'] )
		);
	}
{{#commercial}}

	/**
	 * License key field. Only users with manage_options reach this page.
	 */
	public function render_license_field() {
		printf(
			'<input type="password" class="regular-text" id="%1$s" name="%1$s_key" value="%2$s" autocomplete="off"><p class="description">%3$s</p>',
			esc_attr( '{{prefix}}_license' ),
			esc_attr( (string) get_option( '{{prefix}}_license_key', '' ) ),
			esc_html__( 'Enables automatic updates from the vendor.', '{{slug}}' )
		);
	}
{{/commercial}}
}
