# Upstream

Skills under `skills/` are imported from [WordPress/agent-skills](https://github.com/WordPress/agent-skills) (GPL-2.0-or-later).

- Pinned commit: `eff3785fc28c4380d172094518c66a6a997c95d4` (trunk, 2026-10-26)
- Imported skills: `wordpress-router`, `wp-project-triage`, `wp-plugin-development`, `wp-rest-api`, `wp-abilities-api`, `wp-abilities-audit`, `wp-abilities-verify`, `wp-plugin-directory-guidelines`, `wp-block-development`, `wp-interactivity-api`, `wp-phpstan`, `wp-env`, `wp-playground`, `wp-performance`, `wp-wpcli-and-ops`
- Also imported: `shared/scripts/validate-skills.mjs`, eval scenarios under `eval/scenarios/` whose skills are all bundled here.
- Not imported (out of scope for plugin work): `blueprint`, `wp-block-themes`, `wp-patterns`, `wpds`.

## Local changes

Skills other than `wp-plugin-development` are kept as close to upstream as possible. Every local change to an imported file is listed here so syncs stay reviewable.

| File | Change |
| --- | --- |
| `skills/wp-plugin-development/**` | Locally developed hub: rewritten `SKILL.md`, expanded references, 12 new references, `scripts/check_plugin_basics.mjs`. Upstream changes to this skill must be merged by hand. |
| `skills/wp-woocommerce-extension/**` | New local skill (not in upstream). |
| `skills/wordpress-router/references/decision-tree.md` | WooCommerce route added. Routes for build tooling, testing, and security point to `wp-plugin-development` references instead of planned skills; `blueprint` and `wp-block-themes` marked as not bundled. |
| `eval/scenarios/plugin-*.json` (8 files: scaffold, upgrade routine, i18n, AI Client, PHP-only block, release, multisite uninstall, basics check) | New scenarios for the hub skill. |

## Syncing

Run `node scripts/upstream-diff.mjs` to compare bundled skills against upstream trunk, then update the pinned commit above.
