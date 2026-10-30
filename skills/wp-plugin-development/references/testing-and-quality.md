# Testing and code quality

Use this file when adding or running checks for a plugin. Prefer the tooling the repo already has; triage reports what exists.

## Coding standards (PHPCS + WPCS)

```bash
composer require --dev wp-coding-standards/wpcs:"^3.0" phpcompatibility/phpcompatibility-wp:"*" dealerdirect/phpcodesniffer-composer-installer
```

`phpcs.xml.dist`:

```xml
<?xml version="1.0"?>
<ruleset name="Acme Reviews">
	<file>.</file>
	<exclude-pattern>/vendor/*</exclude-pattern>
	<exclude-pattern>/node_modules/*</exclude-pattern>
	<exclude-pattern>/build/*</exclude-pattern>
	<arg name="extensions" value="php"/>

	<config name="minimum_wp_version" value="7.0"/>
	<config name="testVersion" value="7.4-"/>

	<rule ref="WordPress"/>
	<rule ref="PHPCompatibilityWP"/>

	<rule ref="WordPress.WP.I18n">
		<properties>
			<property name="text_domain" type="array">
				<element value="acme-reviews"/>
			</property>
		</properties>
	</rule>
	<rule ref="WordPress.NamingConventions.PrefixAllGlobals">
		<properties>
			<property name="prefixes" type="array">
				<element value="acme_reviews"/>
				<element value="Acme\Reviews"/>
			</property>
		</properties>
	</rule>
</ruleset>
```

- `vendor/bin/phpcs` to check, `vendor/bin/phpcbf` to auto-fix formatting.
- The `WordPress.Security.*` sniffs (nonce verification, escaping, sanitization) find real bugs; fix them instead of adding `phpcs:ignore`. When an ignore is justified, scope it to one sniff and add a reason.
- Static analysis beyond PHPCS: see `wp-phpstan`.

## PHPUnit integration tests

Two common setups:

- **wp-env** (recommended when the repo uses `@wordpress/env`): `npx wp-env start`, then `npx wp-env run tests-cli --env-cwd=wp-content/plugins/acme-reviews vendor/bin/phpunit`. See `wp-env`.
- **Core test suite install**: `wp scaffold plugin-tests acme-reviews` generates `bin/install-wp-tests.sh`, `phpunit.xml.dist`, and `tests/bootstrap.php`; requires a MySQL database.

Use `yoast/phpunit-polyfills` so the same tests run across PHPUnit versions supported by the WordPress test suite.

```php
class Test_Settings extends WP_UnitTestCase {
	public function test_sanitize_drops_unknown_keys() {
		$clean = acme_reviews_sanitize_settings( array( 'title' => '<b>Hi</b>', 'evil' => 1 ) );
		$this->assertSame( array( 'enabled' => false, 'title' => 'Hi' ), $clean );
	}

	public function test_subscriber_cannot_save() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );
		$this->assertFalse( current_user_can( 'manage_options' ) );
	}
}
```

What to cover first: sanitize callbacks, permission checks (allowed and denied users), upgrade routines from each previous schema version, uninstall cleanup, REST routes (`rest_do_request()` with `WP_REST_Request`), and HTTP integrations mocked with `pre_http_request`.

## JavaScript and E2E

- Unit: `wp-scripts test-unit-js` (Jest).
- Lint: `wp-scripts lint-js`, `wp-scripts lint-style`.
- E2E: `@wordpress/e2e-test-utils-playwright` with `wp-scripts test-playwright` against wp-env; test the block editor flows the plugin adds.

## WordPress.org readiness

- Plugin Check (`wp plugin check acme-reviews` with the Plugin Check plugin installed) — see `wp-plugin-directory-guidelines` for running it and triaging findings.

## CI

A minimal GitHub Actions matrix for plugins: PHPCS on the lowest supported PHP, PHPUnit on lowest and highest supported PHP against the lowest supported and latest WordPress, JS lint/build, and Plugin Check on the built zip. Run the build before Plugin Check so it inspects what ships.

## Local self-check script

`node skills/wp-plugin-development/scripts/check_plugin_basics.mjs <plugin-dir>` gives a fast, dependency-free first pass (JSON output). It complements, not replaces, PHPCS and review.

Upstream reference:

- https://make.wordpress.org/core/handbook/testing/automated-testing/phpunit/
- https://github.com/WordPress/WordPress-Coding-Standards
