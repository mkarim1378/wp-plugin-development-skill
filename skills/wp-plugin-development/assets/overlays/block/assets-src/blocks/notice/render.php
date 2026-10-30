<?php
/**
 * Server render for {{slug}}/notice.
 *
 * @package {{namespace}}
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Inner block content.
 * @var WP_Block $block      Block instance.
 */

defined( 'ABSPATH' ) || exit;

if ( empty( $attributes['message'] ) ) {
	return;
}
?>
<div <?php echo get_block_wrapper_attributes( array( 'class' => '{{slug}}-notice' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- core escapes the attributes. ?>>
	<p><?php echo wp_kses_post( $attributes['message'] ); ?></p>
</div>
