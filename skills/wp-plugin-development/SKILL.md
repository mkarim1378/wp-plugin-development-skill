---
name: wp-plugin-development
description: "Use when building, refactoring, reviewing, or releasing WordPress plugins: plugin headers and bootstrap, architecture/prefixing/autoloading, hooks, activation/deactivation/uninstall and upgrade routines, admin pages/menus/notices, Settings API, assets and script modules, custom post types/meta, options/transients/custom tables, cron, HTTP API, i18n, multisite, privacy, security (nonces/capabilities/sanitization/escaping/SQL), WordPress 7.x features (AI Client, PHP-only blocks, DataViews, iframed editor), testing/PHPCS, and readme.txt/release packaging. Hub skill: routes REST, Abilities, blocks, Plugin Directory review, PHPStan, wp-env, and performance work to sibling skills."
compatibility: "Targets WordPress 7.0+ (PHP 7.4.0+); notes WordPress 7.1 changes where they affect plugins. Filesystem-based agent with bash + node. Some workflows require WP-CLI."
---

# WP Plugin Development

Hub skill for WordPress plugin work. Keep this file as the procedure; load only the reference or sibling skill that the current task needs.

Paths of the form `skills/<name>/...` are relative to the directory these skills are installed in (for example `~/.claude/skills/<name>/...` or `<repo>/.claude/skills/<name>/...`).

## When to use

- Creating a new plugin or refactoring an existing one (bootstrap, structure, namespaces, Composer).
- Adding hooks, admin screens, settings, custom post types, meta, cron jobs, or external API calls.
- Lifecycle work: activation, deactivation, uninstall, database/schema upgrades.
- Security fixes or reviews of plugin code.
- Adopting WordPress 7.x features in a plugin.
- Preparing a release: version bump, `readme.txt`, build artifacts, zip.

## Inputs required

- Repo root and target plugin (main plugin file path if known).
- Target WordPress and PHP versions. Default to WP 7.0+ / PHP 7.4+; never use syntax above the plugin's `Requires PHP`.
- Single site or multisite (network-activated?), and whether the plugin ships on WordPress.org.
- Whether the task authorizes code changes or only review.

## Procedure

### 0) Triage

1. `node skills/wp-project-triage/scripts/detect_wp_project.mjs` — project kind, tooling, tests, version hints.
2. `node skills/wp-plugin-development/scripts/detect_plugins.mjs` — locate plugin main files and headers.
3. In a full-site repo, pick the plugin under `wp-content/plugins/` or `wp-content/mu-plugins/` before editing.
4. Follow the repo's existing conventions (coding standard, autoloader, build tool, test runner) over the defaults in this skill.

### 1) Route the task

Load the matching reference (one hop from this file) or hand off to the sibling skill:

| Task | Load |
| --- | --- |
| New plugin, main file, headers, `Requires Plugins` | `references/headers-and-bootstrap.md` |
| Architecture, prefixing, namespaces, Composer, hook timing | `references/structure.md` |
| Activation, deactivation, uninstall, upgrade routines | `references/lifecycle.md` |
| Admin menus, admin-post handlers, notices, list screens | `references/admin-ui.md` |
| Options pages with the Settings API | `references/settings-api.md` |
| Enqueueing scripts/styles, script modules, editor assets | `references/assets-and-script-modules.md` |
| Custom post types, taxonomies, post/term/user meta | `references/content-types-and-meta.md` |
| Options, transients, custom tables, cron | `references/data-and-cron.md` |
| Calling external services (HTTP API) | `references/http-api.md` |
| Translations and text domains | `references/i18n.md` |
| Multisite and network activation | `references/multisite.md` |
| Personal data export/erase, privacy policy text | `references/privacy.md` |
| Any input/output, AJAX, uploads, SQL, redirects | `references/security.md` (always for code that touches user input) |
| WordPress 7.0/7.1 features (AI Client, PHP-only blocks, DataViews, iframed editor) | `references/wp-7-features.md` |
| Custom WP-CLI commands | `references/wp-cli-commands.md` |
| PHPCS/WPCS, PHPUnit, E2E, CI | `references/testing-and-quality.md` |
| Version bump, `readme.txt`, build, zip, SVN | `references/release.md` |
| Something is broken | `references/debugging.md` |

Sibling skills (hand off, then return here for plugin-level guardrails):

| Task | Skill |
| --- | --- |
| REST routes, controllers, schema, `permission_callback` | `wp-rest-api` |
| Registering abilities for AI agents / MCP | `wp-abilities-api` (audit: `wp-abilities-audit`, verify: `wp-abilities-verify`) |
| Blocks shipped by the plugin (`block.json`, deprecations) | `wp-block-development` |
| `data-wp-*` directives, `@wordpress/interactivity` stores | `wp-interactivity-api` |
| WordPress.org submission, GPL, naming, Plugin Check | `wp-plugin-directory-guidelines` |
| Static analysis | `wp-phpstan` |
| Local environment | `wp-env` (or `wp-playground` for disposable runs) |
| Slow queries, autoload bloat, profiling | `wp-performance` |
| Operating a site with WP-CLI (search-replace, multisite targeting) | `wp-wpcli-and-ops` |

### 2) Non-negotiable guardrails

Apply these to every change, whatever the task:

- Every PHP file that is not the entry point starts with `defined( 'ABSPATH' ) || exit;`.
- Prefix everything global (functions, classes outside a namespace, constants, options, transients, hooks, meta keys, script handles, cron hooks) with a unique plugin prefix.
- No work at file load beyond defining things and adding hooks. Register CPTs, blocks and settings on the documented hooks.
- Register activation/deactivation/uninstall hooks from the main file's top level. Activation does not run on plugin updates, so schema changes need a version-checked upgrade routine.
- Input: read explicit keys, `wp_unslash()`, then sanitize/validate. Output: escape late with the context-correct function.
- State-changing requests need a nonce check and a capability check. A nonce is not authorization.
- SQL goes through `$wpdb->prepare()` (`%d`, `%f`, `%s`, `%i` for identifiers); `LIKE` values go through `$wpdb->esc_like()`.
- All user-facing strings are translatable with the plugin's text domain, and never translated before `init`.
- Don't call external services, send telemetry, or load remote assets without user consent and a documented purpose.

### 3) Implement

Make the smallest change that satisfies the task, using the loaded reference. Prefer WordPress APIs over custom code (Settings API over hand-rolled forms, `WP_Filesystem`/media functions over raw file writes, HTTP API over cURL).

### 4) Self-check

Run the deterministic basics check on the plugin directory and fix or justify each finding:

- `node skills/wp-plugin-development/scripts/check_plugin_basics.mjs <plugin-dir>`

It is heuristic (it flags unprepared SQL, raw superglobals, unescaped echoes, missing ABSPATH guards, header/readme mismatches, text domain drift). A clean report is not a security review; read `references/security.md` for anything that handles input.

## Verification

- Plugin activates and deactivates with `WP_DEBUG` and `WP_DEBUG_LOG` on, and no fatals, notices, or `_doing_it_wrong` messages.
- Upgrading from the previous version runs the upgrade routine once; fresh install and upgrade end in the same schema.
- Settings and forms reject a missing/invalid nonce and a user without the capability.
- Uninstall removes exactly the plugin's data (per site on multisite) and nothing else.
- Repo lint/tests pass: PHPCS (WPCS), PHPUnit, PHPStan, JS build/lint, E2E, whichever exist.
- For WordPress.org releases: Plugin Check passes (see `wp-plugin-directory-guidelines`), and `Stable tag` matches the plugin header `Version`.

## Failure modes / debugging

- Activation hook never fires: registered inside another hook or from an included file using the wrong `__FILE__`; or the plugin was updated, not activated.
- Settings don't save: setting not registered for that option group, or capability filter mismatch.
- "Translation loading ... was triggered too early": a translation function ran before `init`.
- Editor styles/scripts missing in the block editor: enqueued with `admin_enqueue_scripts` instead of `enqueue_block_assets`/`block.json` (the editor canvas is iframed).
- Security regressions: nonce without capability check, sanitized input printed without escaping, `wp_ajax_nopriv_` handler trusting the caller.

See `references/debugging.md` for more.

## Escalation

- Treat the Plugin Handbook (https://developer.wordpress.org/plugins/), the Code Reference, and Make Core dev notes as canonical; don't invent APIs or hook names.
- If a change depends on a WordPress version newer than the plugin's `Requires at least`, either guard it (`function_exists()`/`class_exists()`) or ask before raising the requirement.
- Ask before destructive data changes (dropping tables, deleting options on deactivation, bulk meta rewrites).
