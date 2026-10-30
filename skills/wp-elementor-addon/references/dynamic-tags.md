# Dynamic tags

Dynamic tags let users fill a control with data (post meta, plugin data) instead of static text.

```php
add_action( 'elementor/dynamic_tags/register', function ( $dynamic_tags_manager ) {
	$dynamic_tags_manager->register_group( 'acme', array( 'title' => esc_html__( 'Acme', 'acme' ) ) );
	$dynamic_tags_manager->register( new \Acme\Elementor\Tags\Rating() );
} );
```

```php
namespace Acme\Elementor\Tags;

use Elementor\Core\DynamicTags\Tag;
use Elementor\Modules\DynamicTags\Module;

defined( 'ABSPATH' ) || exit;

class Rating extends Tag {
	public function get_name() { return 'acme-rating'; }
	public function get_title() { return esc_html__( 'Average rating', 'acme' ); }
	public function get_group() { return array( 'acme' ); }
	public function get_categories() { return array( Module::TEXT_CATEGORY, Module::NUMBER_CATEGORY ); }

	protected function register_controls() {
		$this->add_control( 'decimals', array(
			'label'   => esc_html__( 'Decimals', 'acme' ),
			'type'    => \Elementor\Controls_Manager::NUMBER,
			'default' => 1,
		) );
	}

	public function render() {
		$post_id  = get_the_ID();
		$decimals = absint( $this->get_settings( 'decimals' ) );
		echo esc_html( number_format_i18n( (float) get_post_meta( $post_id, '_acme_rating', true ), $decimals ) );
	}
}
```

- Categories decide which controls can use the tag: `TEXT_CATEGORY`, `NUMBER_CATEGORY`, `URL_CATEGORY`, `IMAGE_CATEGORY`, `MEDIA_CATEGORY`, `COLOR_CATEGORY`, `POST_META_CATEGORY`, `GALLERY_CATEGORY`.
- Data tags (returning values instead of echoing, e.g. for images/URLs) extend `\Elementor\Core\DynamicTags\Data_Tag` and implement `get_value()`.
- Escape output; tags render in contexts you don't control.
- Respect permissions: never expose private meta (`_` prefixed or user data) to editors who couldn't otherwise read it.
- Mark widgets using user-dependent tags as dynamic (don't return `false` from `is_dynamic_content()`).
