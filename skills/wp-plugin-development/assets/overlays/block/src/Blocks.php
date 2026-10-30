<?php
/**
 * Block registration.
 *
 * @package {{namespace}}
 */

namespace {{namespace}};

defined( 'ABSPATH' ) || exit;

/**
 * Registers every block built into build/blocks from the generated manifest (one file read, no per-block JSON parsing).
 */
final class Blocks {

	/**
	 * Hooks registration on init.
	 */
	public function register() {
		add_action( 'init', array( $this, 'register_blocks' ) );
	}

	/**
	 * Registers the built blocks. Does nothing until `npm run build` has produced build/blocks.
	 */
	public function register_blocks() {
		$dir      = {{PREFIX}}_DIR . 'build/blocks';
		$manifest = $dir . '/blocks-manifest.php';
		if ( ! is_readable( $manifest ) ) {
			return;
		}
		wp_register_block_types_from_metadata_collection( $dir, $manifest ); // WordPress 6.8+.
	}
}
