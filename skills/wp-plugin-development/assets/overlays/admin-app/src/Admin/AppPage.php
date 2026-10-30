<?php
/**
 * React admin page.
 *
 * @package {{namespace}}
 */

namespace {{namespace}}\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Tools > {{name}}: mounts the React app built from assets-src/admin.
 */
final class AppPage {

	const SLUG   = '{{slug}}-app';
	const HANDLE = '{{slug}}-admin-app';

	/**
	 * Page hook suffix, set on admin_menu.
	 *
	 * @var string
	 */
	private $hook_suffix = '';

	/**
	 * Hooks the page into WordPress.
	 */
	public function register() {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	/**
	 * Adds the page under Tools.
	 */
	public function add_page() {
		$this->hook_suffix = (string) add_management_page(
			__( '{{name}}', '{{slug}}' ),
			__( '{{name}}', '{{slug}}' ),
			'manage_options',
			self::SLUG,
			array( $this, 'render' )
		);
	}

	/**
	 * Loads the app only on its own screen.
	 *
	 * @param string $hook_suffix Current admin page.
	 */
	public function enqueue( $hook_suffix ) {
		$asset_file = {{PREFIX}}_DIR . 'build/admin/index.asset.php';
		if ( $hook_suffix !== $this->hook_suffix || ! is_readable( $asset_file ) ) {
			return;
		}
		$asset = include $asset_file;

		wp_enqueue_script( self::HANDLE, {{PREFIX}}_URL . 'build/admin/index.js', $asset['dependencies'], $asset['version'], array( 'in_footer' => true ) );
		wp_set_script_translations( self::HANDLE, '{{slug}}' );
		wp_enqueue_style( 'wp-components' );
	}

	/**
	 * Mount point for the app.
	 */
	public function render() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<?php if ( ! is_readable( {{PREFIX}}_DIR . 'build/admin/index.asset.php' ) ) : ?>
				<?php wp_admin_notice( esc_html__( 'The admin app is not built yet. Run "npm run build".', '{{slug}}' ), array( 'type' => 'warning' ) ); ?>
			<?php endif; ?>
			<div id="{{slug}}-app"></div>
		</div>
		<?php
	}
}
