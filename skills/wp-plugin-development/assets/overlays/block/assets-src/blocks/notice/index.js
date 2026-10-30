import { registerBlockType } from '@wordpress/blocks';

import Edit from './edit';
import metadata from './block.json';

// Dynamic block: no save(), the markup comes from render.php.
registerBlockType( metadata.name, {
	edit: Edit,
} );
