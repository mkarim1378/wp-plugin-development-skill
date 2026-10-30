# Custom WP-CLI commands

Use this file when a plugin should expose maintenance or batch operations on the command line. For running WP-CLI against a site (search-replace, multisite targeting, cron/cache), see `wp-wpcli-and-ops`.

## Registering a command

```php
if ( defined( 'WP_CLI' ) && WP_CLI ) {
	WP_CLI::add_command( 'acme-reviews', \Acme\Reviews\Cli\Command::class );
}
```

```php
namespace Acme\Reviews\Cli;

use WP_CLI;

/**
 * Manage Acme Reviews.
 */
class Command {
	/**
	 * Recalculate cached ratings.
	 *
	 * ## OPTIONS
	 *
	 * [--post_id=<id>]
	 * : Only recalculate this post.
	 *
	 * [--dry-run]
	 * : Report what would change without writing.
	 *
	 * ## EXAMPLES
	 *
	 *     wp acme-reviews recalc --dry-run
	 *
	 * @subcommand recalc
	 */
	public function recalc( $args, $assoc_args ) {
		$dry_run = WP_CLI\Utils\get_flag_value( $assoc_args, 'dry-run', false );
		$ids     = isset( $assoc_args['post_id'] ) ? array( absint( $assoc_args['post_id'] ) ) : acme_reviews_all_ids();

		$progress = WP_CLI\Utils\make_progress_bar( 'Recalculating', count( $ids ) );
		foreach ( $ids as $id ) {
			if ( ! $dry_run ) {
				acme_reviews_recalculate( $id ); // same service the admin UI and cron use
			}
			$progress->tick();
		}
		$progress->finish();

		WP_CLI::success( sprintf( '%d posts processed.', count( $ids ) ) );
	}
}
```

## Guardrails

- The PHPDoc block is the command's help and argument spec (`wp help acme-reviews recalc`); keep it accurate.
- Commands are thin adapters over the same service code the admin UI, REST, cron, and abilities use. Don't duplicate business logic.
- WP-CLI runs without a logged-in user unless `--user=` is passed; capability checks in shared code will fail. Decide explicitly whether the command requires `--user`.
- Destructive commands need `--dry-run` and/or `WP_CLI::confirm()` (skippable with `--yes`).
- Use `WP_CLI::error()` (exits non-zero), `WP_CLI::warning()`, `WP_CLI::log()`, and `WP_CLI\Utils\format_items()` for `--format=table|json|csv` output so scripts can consume it.
- Process large sets in batches and call `wp_cache_flush_runtime()` (or clear `$wpdb->queries`) between batches to keep memory flat.
- Provide a manual trigger for each cron job here (`wp acme-reviews sync`) so cron problems can be debugged.

Upstream reference:

- https://make.wordpress.org/cli/handbook/guides/commands-cookbook/
