# Iranian SMS providers and OTP

## Provider abstraction

Iranian SMS providers (Kavenegar, Melipayamak, SMS.ir, Ghasedak, IPPanel/FarazSMS, and others) have different APIs, but plugins usually need two operations: send a templated (pattern) message and send free text. Code against an interface so providers are swappable and testable:

```php
interface Acme_Sms_Provider {
	/** Send a pre-approved pattern/template (OTP, order status). Returns provider message ID or WP_Error. */
	public function send_pattern( string $mobile, string $pattern, array $params );

	/** Send free text (where allowed). Returns provider message ID or WP_Error. */
	public function send_text( string $mobile, string $text );
}
```

- Service messages (OTP, order notifications) generally go through provider "pattern"/"lookup"/"verify" endpoints with templates approved in the provider panel; they are delivered faster and are not blocked like advertising lines. Check each provider's current rules.
- Store the API key as a non-autoloaded option or constant; never expose it to JS.
- Normalize mobile numbers with `Persian::normalize_mobile()` and convert to the provider's format.
- Send asynchronously for notifications (Action Scheduler / cron), synchronously only for OTP.
- Use `wp_remote_post()` with a short timeout, check HTTP status **and** the provider's own status code in the body, and log failures (without the API key or the OTP).

## OTP (login or phone verification)

```php
function acme_otp_send( $mobile ) {
	$mobile = Persian::normalize_mobile( $mobile );
	if ( '' === $mobile ) {
		return new WP_Error( 'acme_invalid_mobile', __( 'Invalid mobile number.', 'acme' ) );
	}

	// Rate limits: per phone and per IP.
	$ip_key = 'acme_otp_ip_' . md5( acme_client_ip() );
	if ( get_transient( 'acme_otp_wait_' . $mobile ) || (int) get_transient( $ip_key ) >= 10 ) {
		return new WP_Error( 'acme_otp_rate', __( 'Please wait before requesting another code.', 'acme' ) );
	}

	$code = (string) random_int( 10000, 99999 );
	set_transient( 'acme_otp_' . $mobile, array( 'hash' => wp_hash_password( $code ), 'tries' => 0 ), 2 * MINUTE_IN_SECONDS );
	set_transient( 'acme_otp_wait_' . $mobile, 1, MINUTE_IN_SECONDS );
	set_transient( $ip_key, (int) get_transient( $ip_key ) + 1, HOUR_IN_SECONDS );

	return acme_sms()->send_pattern( $mobile, 'acme-otp', array( 'code' => $code ) );
}

function acme_otp_verify( $mobile, $code ) {
	$mobile = Persian::normalize_mobile( $mobile );
	$state  = get_transient( 'acme_otp_' . $mobile );
	if ( ! is_array( $state ) || $state['tries'] >= 5 ) {
		delete_transient( 'acme_otp_' . $mobile );
		return false;
	}
	if ( ! wp_check_password( Persian::to_latin_digits( $code ), $state['hash'] ) ) {
		++$state['tries'];
		set_transient( 'acme_otp_' . $mobile, $state, 2 * MINUTE_IN_SECONDS );
		return false;
	}
	delete_transient( 'acme_otp_' . $mobile ); // single use
	return true;
}
```

Rules:

- `random_int()`, never `rand()`/`mt_rand()`.
- Hash the code (`wp_hash_password()`/`wp_check_password()`), expire it (2–5 minutes), make it single-use, and cap attempts.
- Rate-limit sends per phone and per IP; the SMS bill is an attack target (SMS pumping).
- Same response whether or not an account exists for the number.
- Determine the client IP carefully: only trust `X-Forwarded-For` when the site is behind a known proxy/CDN (Iranian CDNs such as ArvanCloud set their own headers).
- After OTP login, use core auth (`wp_set_auth_cookie()`), regenerate the session, and log the event.
- Expose OTP endpoints via REST with nonces for logged-in flows and strict rate limits for public ones.
