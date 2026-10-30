# Release and packaging

Use this file when bumping a version, writing `readme.txt`, building the distributable zip, or deploying to WordPress.org.

## Version bump checklist

The version lives in several places; keep them identical:

- Plugin header `Version:` in the main file.
- The version constant (`ACME_REVIEWS_VERSION`) used for asset cache busting.
- `readme.txt` `Stable tag:` (WordPress.org serves the SVN tag named here).
- `package.json` `version` (if present).
- DB/schema version constant only if this release contains a migration (see `lifecycle.md`).

Also update `Tested up to:` (major.minor of the latest WordPress you tested, e.g. `7.1`) and add a changelog entry.

## readme.txt

```
=== Acme Reviews ===
Contributors: wporgusername
Tags: reviews, ratings, products
Requires at least: 7.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Collect and display product reviews. (≤ 150 characters, no markup)

== Description ==

What the plugin does, for users.

== External services ==

This plugin connects to the Example Reviews API to fetch ratings. It sends the product ID when a product page is viewed.
Terms: https://example.com/terms — Privacy policy: https://example.com/privacy

== Installation ==

1. Upload the plugin and activate it.

== Frequently Asked Questions ==

= Question? =

Answer.

== Screenshots ==

1. Caption for screenshot-1.png

== Changelog ==

= 1.2.0 =
* Feature: ...
* Fix: ...

== Upgrade Notice ==

= 1.2.0 =
Short reason to upgrade (≤ 300 characters).
```

Rules:

- `Requires at least`, `Requires PHP` must match the plugin header. `Contributors` are WordPress.org usernames.
- Up to 5 tags are shown; don't use competitor names as tags.
- Document every external service (guideline 6/7) and any data the plugin sends.
- Validate with the readme validator on WordPress.org before release.

## Building the zip

Ship runtime files only. Exclude development files with a `.distignore` (used by `wp dist-archive`) or the `files` field in `package.json` (used by `wp-scripts plugin-zip`):

```
/.git
/.github
/node_modules
/tests
/src-js
.distignore
.editorconfig
.wp-env.json
phpcs.xml.dist
phpunit.xml.dist
package.json
package-lock.json
composer.json
composer.lock
```

Build steps (adapt to the repo's scripts):

```bash
composer install --no-dev --optimize-autoloader
npm ci && npm run build
wp i18n make-pot . languages/acme-reviews.pot --exclude=node_modules,vendor
wp dist-archive .   # needs: wp package install wp-cli/dist-archive-command
# or: npx wp-scripts plugin-zip
```

Then verify the zip:

- Unzip into a clean site, activate, and smoke-test the main flows.
- The zip's top-level folder is the plugin slug.
- `vendor/autoload.php` and `build/*.asset.php` are present; tests and dev configs are not.
- Run Plugin Check against the unzipped build (see `wp-plugin-directory-guidelines`).

## WordPress.org SVN deploy

- Layout: `trunk/` (development copy), `tags/<version>/` (immutable releases), `assets/` (banner `banner-772x250.png` / `banner-1544x500.png`, icon `icon-128x128.png` / `icon-256x256.png`, `screenshot-N.png`).
- Copy the built files into `trunk/`, then `svn cp trunk tags/1.2.0`, set `Stable tag: 1.2.0` in `trunk/readme.txt`, and commit.
- From GitHub, the `10up/action-wordpress-plugin-deploy` action automates this on tag push (uses `.distignore`); `10up/action-wordpress-plugin-asset-update` updates readme/assets without a release.
- Readme-only changes (e.g. bumping `Tested up to`) can be committed to `trunk/` and the current tag without a new version.

## Private / commercial distribution

- Set `Update URI` in the header and implement updates via the `update_plugins_{$hostname}` filter (WP 5.8+), or use an established updater library.
- Never hijack WordPress.org updates for a slug you don't own.

Upstream reference:

- https://developer.wordpress.org/plugins/wordpress-org/how-your-readme-txt-works/
- https://developer.wordpress.org/plugins/wordpress-org/how-to-use-subversion/
- https://developer.wordpress.org/plugins/wordpress-org/plugin-assets/
