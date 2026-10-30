# fa_IR translations

## Workflow

1. Make every string translatable with the plugin's text domain (see `wp-plugin-development` `i18n.md`).
2. Generate the template: `wp i18n make-pot . languages/acme.pot --exclude=node_modules,vendor,tests`.
3. Translate:
   - WordPress.org plugins: translate on translate.wordpress.org (Persian locale team approves); language packs are delivered automatically.
   - Self-hosted/commercial plugins: create `languages/acme-fa_IR.po` with Poedit or Loco Translate, then compile:

```bash
wp i18n make-mo languages
wp i18n make-php languages
wp i18n make-json languages --no-purge
```

   and load them with `load_plugin_textdomain( 'acme', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' )` on `init`.

## Persian-specific translation notes

- Plural forms for fa: `nplurals=2; plural=(n > 1);` (GlotPress setting). Still use `_n()`; some strings differ for 1 vs many.
- Placeholders keep their position markers (`%1$s`) because Persian word order differs from English.
- Translate units and currency words consistently: «تومان» vs «ریال» must match the store currency, not be hard-coded in strings.
- Keep technical identifiers (shortcode names, option keys, URLs) untranslated.
- Use the half-space (ZWNJ) correctly in translations (می‌شود, ‌ها suffix).
- Don't put Persian strings directly in code as source strings; source strings are English, Persian goes in the `.po` file. (Plugins only for Iran sometimes ignore this; it blocks future translation and WordPress.org review prefers English source strings.)

## JS translations

`wp_set_script_translations( 'acme-admin', 'acme', plugin_dir_path( __FILE__ ) . 'languages' )` for self-hosted JSON files; WordPress.org language packs need only the first two arguments.
