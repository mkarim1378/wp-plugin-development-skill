# Security of Elementor addons

Most published vulnerabilities in Elementor addons are **stored XSS through widget settings**: a Contributor/Author with Elementor access saves a malicious value that later runs in an admin's browser. Treat every control value as attacker-controlled.

## Checklist

- [ ] Every setting printed in `render()` is escaped for its context (`esc_html`, `esc_attr`, `esc_url`, `wp_kses_post`).
- [ ] `content_template()` uses `{{ }}` (escaped) for settings; `{{{ }}}` only for strings the template built itself.
- [ ] HTML tag settings (heading level, wrapper tag) are validated against an allow list (`in_array( $tag, array( 'h1', 'h2', 'h3', 'div', 'span', 'p' ), true )`) — or use `\Elementor\Utils::validate_html_tag()`.
- [ ] URL controls use `add_link_attributes()`; `custom_attributes` are not printed raw.
- [ ] No `unfiltered_html`-only features (raw HTML/JS controls) without checking `current_user_can( 'unfiltered_html' )` on save and output.
- [ ] AJAX/REST endpoints used by widgets have nonces and capability checks; public endpoints return only public data.
- [ ] Widgets that query posts respect `post_status` and permissions (don't show drafts/private posts to visitors).
- [ ] Data attributes for JS use `wp_json_encode()` + `esc_attr()`.
- [ ] Template/import features don't load remote JSON or execute remote code.

## Testing

Paste these into text, URL, and select controls (via the editor, or by editing `_elementor_data` in tests) and confirm they render as inert text:

```
"><img src=x onerror=alert(1)>
javascript:alert(1)
</script><script>alert(1)</script>
```

Also run `check_plugin_basics.mjs` and PHPCS (`WordPress.Security.EscapeOutput`) on the widget files.
