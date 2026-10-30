# Roadmap

Phases are ordered so each one builds on the previous: shared foundations first, then domain skills that reuse them, then automated evaluation over everything.

Every phase ends with: facts checked against official docs (no invented APIs), eval scenarios for new behaviour, `npm run check` green, `UPSTREAM.md`/`README.md` updated, and its own commits.

## Phase 1 — Foundations: scaffold template and stronger self-check

Reused by every later phase.

- [x] `skills/wp-plugin-development/assets/plugin-template/`: main file, `uninstall.php`, `readme.txt`, `src/` with PSR-4 autoload, `composer.json`, `package.json` (`@wordpress/scripts`), `phpcs.xml.dist` (WPCS + PHPCompatibilityWP), `phpunit.xml.dist` + `tests/bootstrap.php`, `.wp-env.json`, `.distignore`, `.gitattributes`, `.github/workflows/ci.yml`.
- [x] `scripts/scaffold_plugin.mjs`: generate a plugin from the template with slug, name, prefix, namespace, text domain; `--dry-run`; refuses to overwrite.
- [x] Generated plugin passes `check_plugin_basics` with zero findings and PHP lint.
- [x] New `check_plugin_basics` rules: `register_rest_route` without `permission_callback`, `wp_ajax_nopriv_` handlers, `flush_rewrite_rules()` outside activation/deactivation, `load_plugin_textdomain()` before `init`, `add_option`/`update_option` with forced autoload on large values, `$_FILES` without `wp_handle_upload()`.
- [x] `--format sarif` output for GitHub code scanning, plus a CI example.
- [x] Tests for every new rule; SKILL.md and `testing-and-quality.md` updated.

## Phase 2 — WooCommerce extension skill

New skill `skills/wp-woocommerce-extension/`.

- [x] SKILL.md hub with routing to references; compatibility contract matches the repo (WP 7.0+, PHP 7.4+) plus target WooCommerce version.
- [x] References: HPOS and order CRUD (`FeaturesUtil::declare_compatibility()`, `wc_get_orders()`, no post APIs on orders), products and data stores, cart/price hooks (tiered/dynamic pricing pitfalls), Cart/Checkout Blocks integration (payment method registration, Store API, checkout fields), payment gateways (`WC_Payment_Gateway`, refunds, webhooks/callbacks, idempotency), emails, settings tabs, Action Scheduler, `WC_Logger`, WooCommerce REST API, testing with WooCommerce in wp-env.
- [x] `check_plugin_basics` WooCommerce rules (post meta APIs on orders, missing HPOS declaration, missing `Requires Plugins: woocommerce`).
- [x] Scaffold option `--woocommerce` (HPOS + Blocks declarations, WooCommerce dependency checks).
- [x] Hub routing table and router decision tree point WooCommerce work here.
- [x] Eval scenarios: HPOS migration, tiered pricing, Blocks-compatible gateway, order import.

## Phase 3 — Persian localization and Iranian market

- [ ] New skill `skills/wp-persian-localization/`: Jalali dates (storage stays Gregorian/UTC, display converts), Persian/Arabic digit normalization on input, RTL admin and frontend, `fa_IR` translation workflow, Persian fonts loaded locally, Iranian phone/national ID validation.
- [ ] WooCommerce reference for Iranian gateways (Zarinpal, IDPay, and similar): request → redirect → verify flow, server-side amount verification, Rial/Toman conversion, duplicate/late callbacks, user returning without paying, logging without leaking tokens.
- [ ] Reference for Iranian SMS providers: provider abstraction, OTP rate limiting and expiry, queueing sends.
- [ ] Eval scenarios for each.

## Phase 4 — Commercial plugins: licensing and private updates

- [ ] Hub reference `commercial-distribution.md`: `Update URI` + `update_plugins_{$hostname}`, update server response shape, `plugins_api` details, license activation/deactivation, caching license checks, failing safe (no fatal, no remote kill switch), not violating WordPress.org guidelines for the free version.
- [ ] Scaffold option `--commercial` with an updater skeleton.
- [ ] Eval scenarios.

## Phase 5 — Elementor addon skill

- [ ] New skill `skills/wp-elementor-addon/`: registering widgets on `elementor/widgets/register`, controls and responsive controls, `render()` escaping, `content_template()`, dependencies on Elementor version, dynamic tags, assets via `get_script_depends()`/`get_style_depends()`, Elementor Pro detection, performance (no per-widget queries in loops).
- [ ] Scaffold option `--elementor`.
- [ ] Eval scenarios.

## Phase 6 — Automated eval runner

- [ ] `scripts/run-evals.mjs`: runs each scenario in `eval/scenarios/` against a disposable fixture repo with `claude -p` (headless), captures the transcript, and grades it against `success_criteria` with a judge prompt.
- [ ] JSON + Markdown report, filter by skill, cost/time limits.
- [ ] Baseline run over all skills; fix the gaps it finds in every phase above.
- [ ] Document the workflow in README; optional manual CI job.
