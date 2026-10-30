<?php
/**
 * Persian (fa_IR) helpers: digits, text normalization, Iranian identifiers, Jalali dates, Rial/Toman.
 *
 * Copy into your plugin and change the namespace to your plugin's namespace.
 * Pure PHP 7.4+, no WordPress dependency (safe to unit test without WordPress).
 *
 * @package Acme\Persian
 */

namespace Acme\Persian;

defined( 'ABSPATH' ) || defined( 'PERSIAN_HELPERS_TESTING' ) || exit;

/**
 * Static helpers. All methods are pure.
 */
final class Persian {

	const PERSIAN_DIGITS = array( '۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹' );
	const ARABIC_DIGITS  = array( '٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩' );
	const LATIN_DIGITS   = array( '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' );

	const MONTHS = array( 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند' );

	/**
	 * Converts Persian and Arabic-Indic digits to ASCII digits. Run on every numeric input before validation.
	 *
	 * @param string $value Input.
	 * @return string
	 */
	public static function to_latin_digits( $value ) {
		return str_replace( array_merge( self::PERSIAN_DIGITS, self::ARABIC_DIGITS ), array_merge( self::LATIN_DIGITS, self::LATIN_DIGITS ), (string) $value );
	}

	/**
	 * Converts ASCII digits to Persian digits for display only (never store the result).
	 *
	 * @param string|int $value Value.
	 * @return string
	 */
	public static function to_persian_digits( $value ) {
		return str_replace( self::LATIN_DIGITS, self::PERSIAN_DIGITS, (string) $value );
	}

	/**
	 * Normalizes Arabic letter variants to Persian ones (ي→ی, ك→ک, ى→ی, ة→ه) and digits to ASCII,
	 * and trims. Use for search keys and comparisons, not for altering user content.
	 *
	 * @param string $value Input.
	 * @return string
	 */
	public static function normalize_text( $value ) {
		$value = str_replace( array( 'ي', 'ى', 'ك', 'ة' ), array( 'ی', 'ی', 'ک', 'ه' ), (string) $value );
		return trim( self::to_latin_digits( $value ) );
	}

	/**
	 * Normalizes an Iranian mobile number to 09XXXXXXXXX, or returns '' if invalid.
	 * Accepts +98, 0098, 98, 0 prefixes, spaces, dashes and Persian digits.
	 *
	 * @param string $value Input.
	 * @return string
	 */
	public static function normalize_mobile( $value ) {
		$digits = preg_replace( '/\D+/', '', self::to_latin_digits( $value ) );
		if ( preg_match( '/^(?:0098|98|0)?(9\d{9})$/', (string) $digits, $m ) ) {
			return '0' . $m[1];
		}
		return '';
	}

	/**
	 * Validates an Iranian national code (کد ملی).
	 *
	 * @param string $value Input.
	 * @return bool
	 */
	public static function is_valid_national_code( $value ) {
		$code = preg_replace( '/\D+/', '', self::to_latin_digits( $value ) );
		if ( ! preg_match( '/^\d{10}$/', (string) $code ) || preg_match( '/^(\d)\1{9}$/', $code ) ) {
			return false;
		}
		$sum = 0;
		for ( $i = 0; $i < 9; $i++ ) {
			$sum += (int) $code[ $i ] * ( 10 - $i );
		}
		$remainder = $sum % 11;
		$check     = (int) $code[9];
		$expected  = $remainder < 2 ? $remainder : 11 - $remainder;
		return $expected === $check;
	}

	/**
	 * Validates a 10-digit Iranian postal code.
	 *
	 * @param string $value Input.
	 * @return bool
	 */
	public static function is_valid_postal_code( $value ) {
		return (bool) preg_match( '/^\d{10}$/', preg_replace( '/[\s-]+/', '', self::to_latin_digits( $value ) ) );
	}

	/**
	 * Validates an Iranian IBAN (شبا): IR + 24 digits, ISO 13616 mod-97 check.
	 *
	 * @param string $value Input.
	 * @return bool
	 */
	public static function is_valid_sheba( $value ) {
		$iban = strtoupper( preg_replace( '/\s+/', '', self::to_latin_digits( $value ) ) );
		if ( preg_match( '/^\d{24}$/', $iban ) ) {
			$iban = 'IR' . $iban;
		}
		if ( ! preg_match( '/^IR\d{24}$/', $iban ) ) {
			return false;
		}
		// Move country code + check digits to the end; I=18, R=27.
		$numeric = substr( $iban, 4 ) . '1827' . substr( $iban, 2, 2 );
		$mod     = 0;
		foreach ( str_split( $numeric, 7 ) as $chunk ) {
			$mod = (int) ( $mod . $chunk ) % 97;
		}
		return 1 === $mod;
	}

	/**
	 * Converts Toman to Rial (gateways and banks use Rial).
	 *
	 * @param int|float|string $toman Amount in Toman.
	 * @return int
	 */
	public static function toman_to_rial( $toman ) {
		return (int) round( (float) self::to_latin_digits( $toman ) * 10 );
	}

	/**
	 * Converts a Gregorian date to Jalali (33-year arithmetic cycle; matches ICU's Persian calendar).
	 *
	 * @param int $gy Year.
	 * @param int $gm Month 1-12.
	 * @param int $gd Day.
	 * @return int[] [ year, month, day ]
	 */
	public static function gregorian_to_jalali( $gy, $gm, $gd ) {
		$g_d_m = array( 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334 );
		$gy2   = ( $gm > 2 ) ? ( $gy + 1 ) : $gy;
		$days  = 355666 + ( 365 * $gy ) + intdiv( $gy2 + 3, 4 ) - intdiv( $gy2 + 99, 100 ) + intdiv( $gy2 + 399, 400 ) + $gd + $g_d_m[ $gm - 1 ];
		$jy    = -1595 + ( 33 * intdiv( $days, 12053 ) );
		$days %= 12053;
		$jy   += 4 * intdiv( $days, 1461 );
		$days %= 1461;
		if ( $days > 365 ) {
			--$days;
			$jy   += intdiv( $days, 365 );
			$days %= 365;
		}
		if ( $days < 186 ) {
			$jm = 1 + intdiv( $days, 31 );
			$jd = 1 + ( $days % 31 );
		} else {
			$jm = 7 + intdiv( $days - 186, 30 );
			$jd = 1 + ( ( $days - 186 ) % 30 );
		}
		return array( $jy, $jm, $jd );
	}

	/**
	 * Converts a Jalali date to Gregorian.
	 *
	 * @param int $jy Year.
	 * @param int $jm Month 1-12.
	 * @param int $jd Day.
	 * @return int[] [ year, month, day ]
	 */
	public static function jalali_to_gregorian( $jy, $jm, $jd ) {
		$jy   += 1595;
		$days  = -355668 + ( 365 * $jy ) + ( intdiv( $jy, 33 ) * 8 ) + intdiv( ( $jy % 33 ) + 3, 4 ) + $jd + ( ( $jm < 7 ) ? ( $jm - 1 ) * 31 : ( ( $jm - 7 ) * 30 ) + 186 );
		$gy    = 400 * intdiv( $days, 146097 );
		$days %= 146097;
		if ( $days > 36524 ) {
			--$days;
			$gy   += 100 * intdiv( $days, 36524 );
			$days %= 36524;
			if ( $days >= 365 ) {
				++$days;
			}
		}
		$gy   += 4 * intdiv( $days, 1461 );
		$days %= 1461;
		if ( $days > 365 ) {
			--$days;
			$gy   += intdiv( $days, 365 );
			$days %= 365;
		}
		$gd    = $days + 1;
		$leap  = ( 0 === $gy % 4 && 0 !== $gy % 100 ) || 0 === $gy % 400;
		$month = array( 31, $leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 );
		$gm    = 1;
		foreach ( $month as $length ) {
			if ( $gd <= $length ) {
				break;
			}
			$gd -= $length;
			++$gm;
		}
		return array( $gy, $gm, $gd );
	}

	/**
	 * Formats a Unix timestamp as a Jalali date. Supported tokens: Y (1404), m (01), n (1), d (05), j (5),
	 * F (month name), H, i, s. Uses IntlDateFormatter when available for full locale support otherwise.
	 *
	 * @param int           $timestamp Unix timestamp (UTC).
	 * @param string        $format    Format using the tokens above.
	 * @param \DateTimeZone $timezone  Display timezone (in WordPress: wp_timezone()).
	 * @param bool          $persian_digits Convert digits to Persian.
	 * @return string
	 */
	public static function format_jalali( $timestamp, $format, \DateTimeZone $timezone, $persian_digits = false ) {
		$date              = ( new \DateTimeImmutable( '@' . (int) $timestamp ) )->setTimezone( $timezone );
		list( $y, $m, $d ) = self::gregorian_to_jalali( (int) $date->format( 'Y' ), (int) $date->format( 'n' ), (int) $date->format( 'j' ) );

		$map = array(
			'Y' => (string) $y,
			'm' => sprintf( '%02d', $m ),
			'n' => (string) $m,
			'd' => sprintf( '%02d', $d ),
			'j' => (string) $d,
			'F' => self::MONTHS[ $m - 1 ],
			'H' => $date->format( 'H' ),
			'i' => $date->format( 'i' ),
			's' => $date->format( 's' ),
		);

		$out = '';
		$len = strlen( $format );
		for ( $i = 0; $i < $len; $i++ ) {
			$char = $format[ $i ];
			if ( '\\' === $char && $i + 1 < $len ) {
				$out .= $format[ ++$i ];
				continue;
			}
			$out .= isset( $map[ $char ] ) ? $map[ $char ] : $char;
		}
		return $persian_digits ? self::to_persian_digits( $out ) : $out;
	}
}
