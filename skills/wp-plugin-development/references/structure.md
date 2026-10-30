# Plugin structure, prefixing, and hooks

Use this file when introducing or refactoring a plugin architecture, or when deciding where and when code runs.

## Core concepts

- The main plugin file holds the header and bootstraps the plugin (see `headers-and-bootstrap.md`).
- Loading a file should only define things. Behaviour starts from hooks.
- Group code by responsibility (admin, REST, frontend, CLI, integrations) and load each part only in the context that needs it.

## Prefixing and namespaces

Everything in the global scope is shared with WordPress core and every other plugin.

- Pick a prefix of 4+ characters derived from the slug (`acme_reviews_`, `ACME_REVIEWS_`, `Acme\Reviews\`). `wp_`, `__`, and `_` are reserved.
- Namespace PHP classes and functions; still prefix options, transients, meta keys, hook names, cron hooks, script/style handles, nonce actions, REST namespaces, CPT/taxonomy slugs, and global JS variables.
- Don't wrap your own functions/classes in `if ( ! function_exists() )` / `class_exists()` to "avoid conflicts": that silently runs someone else's code with your name. Use a unique prefix instead; such guards are only for functions you deliberately make pluggable.

## Composer dependencies

- Use Composer PSR-4 autoloading for `src/`. Commit `composer.json` and `composer.lock`; ship `vendor/` in the release build only.
- Third-party libraries in `vendor/` can collide with the same library in another plugin (different versions, one wins). For distributed plugins, prefix vendor namespaces with a tool such as Strauss or PHP-Scoper.
- Libraries must be GPL-compatible and must not require PHP above the plugin's `Requires PHP`.

## Avoid

- Singletons and service locators as the default architecture: they hide dependencies and make testing hard. A plain `Plugin::boot()` that constructs objects and passes dependencies explicitly is enough.
- Heavy work in constructors, or constructors that add hooks as a side effect of being instantiated in tests.
- Global state shared through `global $my_plugin;`.

## Hook timing (cheat sheet)

| Hook | Use for |
| --- | --- |
| `plugins_loaded` | Bootstrap, integration checks, upgrade routine check |
| `init` | CPTs, taxonomies, meta, blocks, shortcodes, rewrite rules, translations available from here |
| `admin_menu` / `network_admin_menu` | Admin pages |
| `admin_init` | Settings API registration, admin-only handlers, privacy policy text |
| `rest_api_init` | REST routes and fields |
| `wp_enqueue_scripts` / `admin_enqueue_scripts` / `enqueue_block_assets` / `enqueue_block_editor_assets` | Assets (see `assets-and-script-modules.md`) |
| `wp_abilities_api_categories_init` / `wp_abilities_api_init` | Abilities (see `wp-abilities-api`) |
| `template_redirect` | Frontend request handling that may redirect |
| `shutdown` | Last-resort cleanup; avoid heavy work |

Notes:

- Use `is_admin()` only to decide whether to load admin code; it is true for `admin-ajax.php` requests and says nothing about permissions.
- Conditional tags (`is_singular()`, `is_page()`) only work after the main query (`wp`, `template_redirect`).
- `wp_doing_ajax()`, `wp_doing_cron()`, `wp_is_serving_rest_request()` (6.5+), and `defined( 'WP_CLI' ) && WP_CLI` identify request contexts.

## Hook hygiene

- Use explicit priorities only when order matters; document why.
- Keep callbacks removable: prefer named methods on an object you can reach, or document the closure-free way to unhook. Anonymous closures cannot be removed by other developers.
- Filters must return a value of the same type they received, including on early returns.
- Provide your own extension points with prefixed names (`do_action( 'acme_reviews_after_save', $review_id )`, `apply_filters( 'acme_reviews_rating_scale', 5 )`) and document their arguments.
- Don't call `remove_all_actions()`/`remove_all_filters()` on core hooks.

## PHP version discipline

The plugin's `Requires PHP` sets the language level. With 7.4 you have typed properties, arrow functions, `??=`, and spread in arrays; you don't have union types, `match`, named arguments, constructor promotion, enums, or `readonly` (PHP 8.0/8.1). Configure PHPCS `testVersion` (PHPCompatibilityWP) to enforce this.

Upstream reference:

- https://developer.wordpress.org/plugins/plugin-basics/best-practices/
- https://developer.wordpress.org/plugins/hooks/
