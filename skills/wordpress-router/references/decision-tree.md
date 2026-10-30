# Router decision tree (v1)

This is a lightweight routing guide. It assumes you can run `wp-project-triage` first.

## Step 1: classify repo kind (from triage)

Use `triage.project.kind` and the strongest signals:

- `wp-core` → treat as WordPress core checkout work (core patches, PHPUnit, build tools).
- `wp-site` → treat as a full site repo (wp-content present; changes might be theme + plugins).
- `wp-block-theme` → theme.json/templates/patterns workflows.
- `wp-theme` → classic theme workflows (templates PHP, `functions.php`, `style.css`).
- `wp-block-plugin` → Gutenberg block development in a plugin (block.json, build pipeline).
- `wp-plugin` / `wp-mu-plugin` → plugin workflows (hooks, admin, settings, cron, REST, security).
- `gutenberg` → Gutenberg monorepo workflows (packages, tooling, docs).

If multiple kinds match, prefer the most specific:
`gutenberg` > `wp-core` > `wp-site` > `wp-block-theme` > `wp-block-plugin` > `wp-theme` > `wp-plugin`.

## Step 2: route by user intent (keywords)

Route by intent even if repo kind is broad (like `wp-site`):

- **Interactivity API / data-wp-* directives / @wordpress/interactivity / viewScriptModule**
  - Route → `wp-interactivity-api`.
- **Abilities API / wp_register_ability / wp-abilities/v1 / @wordpress/abilities**
  - Route → `wp-abilities-api`.
- **Ambiguous WordPress Playground requests**
  - Route → `wp-playground`, then follow its routing wrapper.
- **Blueprint JSON / Blueprint schema / Blueprint steps / Blueprint bundles**
  - Route → `blueprint` (not bundled in this skill pack; install it from WordPress/agent-skills if needed).
- **@wp-playground/cli / server / run-blueprint / build-snapshot / auto-mount / Xdebug**
  - Route → `wp-playground`, then read `references/cli.md` or `references/debugging.md`.
- **playground.wordpress.net / Blueprint Editor / share links / browser-only Playground**
  - Route → `wp-playground`, then read `references/website.md`.
- **Blocks / block.json / registerBlockType / attributes / save serialization**
  - Route → `wp-block-development`.
- **theme.json / Global Styles / templates/*.html / patterns/**
  - Route → `wp-block-themes` (not bundled in this skill pack; install it from WordPress/agent-skills if needed).
- **WooCommerce / orders / HPOS / products / cart / checkout / payment gateway / WC_Order**
  - Route → `wp-woocommerce-extension` (plus `wp-plugin-development` for general plugin guardrails).
- **Persian / fa_IR / Jalali / Shamsi / Iranian gateway (Zarinpal) / Iranian SMS / OTP / RTL Persian**
  - Route → `wp-persian-localization`.
- **Elementor / Widget_Base / elementor/widgets/register / Elementor widget / dynamic tag**
  - Route → `wp-elementor-addon`.
- **Plugins / hooks / activation hook / uninstall / Settings API / admin pages**
  - Route → `wp-plugin-development`.
- **REST endpoint / register_rest_route / permission_callback**
  - Route → `wp-rest-api`.
- **WP-CLI / wp-cli.yml / commands**
  - Route → `wp-wpcli-and-ops`.
- **Build tooling / @wordpress/scripts / webpack / Vite / npm scripts**
  - Route → `wp-plugin-development` (`references/assets-and-script-modules.md`) for plugins.
- **Testing / PHPUnit / wp-env / Playwright**
  - Route → `wp-plugin-development` (`references/testing-and-quality.md`) for plugins, plus `wp-env` for the environment.
- **PHPStan / static analysis / phpstan.neon / phpstan-baseline.neon**
  - Route → `wp-phpstan`.
- **Performance / caching / query profiling / editor slowness**
  - Route → `wp-performance`.
- **Security / nonces / capabilities / sanitization/escaping / uploads**
  - Route → `wp-plugin-development` (`references/security.md`) for plugins.

## Step 3: guardrails checklist (always)

- Verify detected tooling before suggesting commands (Composer vs npm/yarn/pnpm).
- Prefer existing lint/test scripts if present.
- If version constraints aren’t detectable, ask for target WP core and PHP versions.
