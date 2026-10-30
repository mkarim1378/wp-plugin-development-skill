<?php
/**
 * Uninstall cleanup. Runs without the plugin loaded.
 *
 * @package {{namespace}}
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

/**
 * Removes this plugin's data from the current site.
 */
function {{prefix}}_uninstall_site() {
	delete_option( '{{prefix}}_settings' );
	delete_option( '{{prefix}}_db_version' );
	wp_clear_scheduled_hook( '{{prefix}}_daily' );
{{#commercial}}
	delete_option( '{{prefix}}_license_key' );
	delete_transient( '{{prefix}}_update_info' );
{{/commercial}}
}

if ( is_multisite() ) {
	${{prefix}}_site_ids = get_sites(
		array(
			'fields' => 'ids',
			'number' => 0,
		)
	);
	foreach ( ${{prefix}}_site_ids as ${{prefix}}_site_id ) {
		switch_to_blog( ${{prefix}}_site_id );
		{{prefix}}_uninstall_site();
		restore_current_blog();
	}
} else {
	{{prefix}}_uninstall_site();
}
