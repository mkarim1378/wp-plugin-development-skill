import apiFetch from '@wordpress/api-fetch';
import {
	Button,
	Card,
	CardBody,
	Notice,
	Spinner,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import { createRoot, useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

// wp-api-fetch adds the REST nonce for the logged-in user automatically in wp-admin.
const PATH = '/{{slug}}/v1/settings';

function App() {
	const [ settings, setSettings ] = useState( null );
	const [ saving, setSaving ] = useState( false );
	const [ notice, setNotice ] = useState( null );

	useEffect( () => {
		apiFetch( { path: PATH } )
			.then( setSettings )
			.catch( ( error ) =>
				setNotice( { status: 'error', message: error.message } )
			);
	}, [] );

	const save = () => {
		setSaving( true );
		apiFetch( { path: PATH, method: 'POST', data: settings } )
			.then( ( saved ) => {
				setSettings( saved );
				setNotice( {
					status: 'success',
					message: __( 'Settings saved.', '{{slug}}' ),
				} );
			} )
			.catch( ( error ) =>
				setNotice( { status: 'error', message: error.message } )
			)
			.finally( () => setSaving( false ) );
	};

	if ( ! settings ) {
		return notice ? (
			<Notice status="error" isDismissible={ false }>
				{ notice.message }
			</Notice>
		) : (
			<Spinner />
		);
	}

	return (
		<Card>
			<CardBody>
				{ notice && (
					<Notice
						status={ notice.status }
						onRemove={ () => setNotice( null ) }
					>
						{ notice.message }
					</Notice>
				) }
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Enable', '{{slug}}' ) }
					checked={ settings.enabled }
					onChange={ ( enabled ) =>
						setSettings( { ...settings, enabled } )
					}
				/>
				<TextControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'Title', '{{slug}}' ) }
					value={ settings.title }
					onChange={ ( title ) =>
						setSettings( { ...settings, title } )
					}
				/>
				<Button
					variant="primary"
					isBusy={ saving }
					disabled={ saving }
					onClick={ save }
				>
					{ __( 'Save', '{{slug}}' ) }
				</Button>
			</CardBody>
		</Card>
	);
}

const root = document.getElementById( '{{slug}}-app' );
if ( root ) {
	createRoot( root ).render( <App /> );
}
