# Iranian identifiers

All validators in `assets/class-persian.php` accept Persian/Arabic digits, spaces, and dashes. Normalize, validate, then store the normalized form.

| Field | Helper | Stored form |
| --- | --- | --- |
| Mobile | `Persian::normalize_mobile()` returns `09XXXXXXXXX` or `''` | `09123456789` |
| National code (کد ملی) | `Persian::is_valid_national_code()` | 10 ASCII digits, keep leading zeros (store as string) |
| Postal code | `Persian::is_valid_postal_code()` | 10 ASCII digits |
| Sheba (IBAN) | `Persian::is_valid_sheba()` (mod-97) | `IR` + 24 digits, no spaces |

```php
$mobile = Persian::normalize_mobile( wp_unslash( $_POST['mobile'] ?? '' ) );
if ( '' === $mobile ) {
	$errors->add( 'acme_mobile', __( 'Enter a valid mobile number, for example 09123456789.', 'acme' ) );
}
```

Notes:

- National codes start with zeros for many people; never cast them to `int`.
- National code checksum: weighted sum of the first 9 digits (weights 10..2) mod 11 = r; check digit is r when r < 2, else 11 − r; codes with ten identical digits are invalid.
- Mobile numbers: accept `+98`, `0098`, `98`, `0` prefixes; for SMS APIs, convert to the provider's expected format (often `09…` or `98…`).
- Landlines and international numbers need different rules; don't run mobile validation on them.
- Validation proves format, not ownership. Verify ownership with OTP (`sms-and-otp.md`) when it matters.
- WooCommerce: put these fields in the Checkout block with the Additional Checkout Fields API and validate in `validate_callback` (see `wp-woocommerce-extension`, `blocks-checkout.md`).
- National code and Sheba are sensitive personal data: restrict who can view them, include them in privacy export/erase (`wp-plugin-development` `privacy.md`), and don't log them.
