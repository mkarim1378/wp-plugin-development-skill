# WordPress Plugin Development Skill

Agent skills that teach AI coding assistants (Claude Code, Cursor, Codex, Copilot, Gemini CLI, …) how to build, review, and release WordPress plugins the right way.

The centrepiece is **`wp-plugin-development`**, a hub skill that covers plugin work end to end and hands off to focused sibling skills imported from the official [WordPress/agent-skills](https://github.com/WordPress/agent-skills) project.

Targets **WordPress 7.0+ / PHP 7.4+**, with notes on WordPress 7.1 changes.

## What's inside

| Skill | Purpose |
| --- | --- |
| **wp-plugin-development** | Hub: headers/bootstrap, architecture and prefixing, hooks, lifecycle and upgrade routines, admin UI, Settings API, assets and script modules, CPTs/meta, options/transients/custom tables/cron, HTTP API, i18n/RTL, multisite, privacy, security, WP 7.x features (AI Client, PHP-only blocks, DataViews, iframed editor), WP-CLI commands, testing, release packaging |
| **wp-woocommerce-extension** | WooCommerce: HPOS/order CRUD, products and tiered pricing, Cart/Checkout blocks, payment gateways, settings/emails, Action Scheduler, REST, testing |
| **wp-persian-localization** | Persian/Iranian market: Jalali dates, digit normalization, RTL and local fonts, fa_IR translations, Iranian identifiers, Zarinpal-style gateways, SMS/OTP; tested PHP helper class |
| **wp-elementor-addon** | Elementor widgets, controls, render escaping and live preview, dynamic tags, version checks, Elementor 4 coexistence, addon security |
| wp-project-triage | Deterministic repo inspection (project kind, tooling, versions) |
| wordpress-router | Classifies a repo and routes to the right skill |
| wp-rest-api | REST routes, controllers, schema, permissions |
| wp-abilities-api / -audit / -verify | Abilities API registration, auditing, and verification |
| wp-plugin-directory-guidelines | WordPress.org guidelines, GPL, naming, Plugin Check |
| wp-block-development | Blocks shipped by plugins (`block.json`, deprecations) |
| wp-interactivity-api | `data-wp-*` directives and stores |
| wp-phpstan | Static analysis |
| wp-env / wp-playground | Local and disposable WordPress environments |
| wp-performance | Profiling, autoload bloat, caching |
| wp-wpcli-and-ops | Operating sites with WP-CLI |

Everything except the locally developed skills (`wp-plugin-development`, `wp-woocommerce-extension`, and later additions marked in bold) is kept as close to upstream as possible; see [UPSTREAM.md](UPSTREAM.md) for the pinned commit and every local change.

### Hub skill layout

```
skills/wp-plugin-development/
├── SKILL.md                 # procedure, routing table, guardrails, verification
├── references/              # topic files, loaded one at a time as needed
├── assets/plugin-template/  # WPCS-clean plugin skeleton used by the scaffold script
└── scripts/
    ├── detect_plugins.mjs       # find plugin main files and headers
    ├── scaffold_plugin.mjs      # generate a new plugin from assets/plugin-template (+ feature overlays)
    └── check_plugin_basics.mjs  # heuristic self-check (SQL, escaping, nonces, REST, uploads, i18n, headers/readme; JSON or SARIF)
```

## Install

Requires Node.js 20+.

```bash
git clone https://github.com/mkarim1378/wp-plugin-development-skill.git
cd wp-plugin-development-skill
```

Global install (all projects, Claude Code):

```bash
node scripts/install.mjs
```

Project install (commit it so your team gets it):

```bash
node scripts/install.mjs --project /path/to/your-plugin-repo
```

Other agents or locations:

```bash
node scripts/install.mjs --target ~/.cursor/skills
```

Options: `--skills a,b` to install a subset (keep `wp-project-triage` with the hub), `--force` to replace already installed skills, `--dry-run` to preview.

## Use

Ask your assistant for plugin work as usual; the skill triggers on plugin tasks. Examples:

- "Add a settings page with a checkbox and an API key field to this plugin."
- "Our custom table needs a new column in 1.3; make sure updated sites get it."
- "Add an AI summary button using WordPress 7.0's AI Client."
- "Prepare release 1.2.0 for WordPress.org."
- "Check this plugin for obvious security problems."

Start a new plugin from the template (add `--woocommerce`, `--commercial`, `--elementor` as needed):

```bash
node ~/.claude/skills/wp-plugin-development/scripts/scaffold_plugin.mjs --slug acme-reviews --name "Acme Reviews"
```

Run the self-check directly:

```bash
node ~/.claude/skills/wp-plugin-development/scripts/check_plugin_basics.mjs path/to/plugin
```

It prints a JSON report (`--format sarif` for GitHub code scanning, `--strict` exits 1 on errors). It is heuristic; it complements PHPCS/WPCS and Plugin Check rather than replacing them.

## Development

```bash
npm run validate      # skill frontmatter + triage contract
npm test              # check_plugin_basics and scaffold tests
npm run upstream-diff # compare bundled skills with WordPress/agent-skills trunk
npm run evals -- --dry-run  # automated eval runner (see below)
```

Eval scenarios live in `eval/scenarios/`. Each describes a prompt, the expected procedure, and success criteria.

### Running evals

`scripts/run-evals.mjs` runs each scenario with Claude Code in headless mode (`claude -p`) inside a fresh temp workspace (a scaffolded or fixture plugin plus all skills in `.claude/skills`), then asks a judge model to grade the transcript and diff against the scenario's criteria. Requires an authenticated `claude` CLI; every run costs API usage.

```bash
node scripts/run-evals.mjs --dry-run                       # list scenarios and the maximum spend
node scripts/run-evals.mjs --scenario plugin-add-settings-page --model sonnet
node scripts/run-evals.mjs --skill wp-woocommerce-extension --budget 1 --min-score 0.8
```

Reports land in `eval/results/<timestamp>/` (`report.md`, `report.json`, transcripts, diffs). The manual `Evals` GitHub workflow runs the same thing with the `ANTHROPIC_API_KEY` secret.

## Credits and license

Bundled skills come from [WordPress/agent-skills](https://github.com/WordPress/agent-skills) by WordPress contributors. This repository is distributed under the same license, GPL-2.0-or-later (see [LICENSE](LICENSE)).
