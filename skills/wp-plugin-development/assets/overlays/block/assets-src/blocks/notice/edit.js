import { __ } from '@wordpress/i18n';
import { RichText, useBlockProps } from '@wordpress/block-editor';

export default function Edit( { attributes, setAttributes } ) {
	const blockProps = useBlockProps( { className: '{{slug}}-notice' } );

	return (
		<div { ...blockProps }>
			<RichText
				tagName="p"
				value={ attributes.message }
				onChange={ ( message ) => setAttributes( { message } ) }
				placeholder={ __( 'Write a notice…', '{{slug}}' ) }
				allowedFormats={ [ 'core/bold', 'core/italic', 'core/link' ] }
			/>
		</div>
	);
}
