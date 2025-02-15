import { useCallback, useEffect } from 'react'
import {
	DefaultContextMenu,
	DefaultContextMenuContent,
	DefaultHelpMenu,
	DefaultHelpMenuContent,
	DefaultKeyboardShortcutsDialog,
	DefaultKeyboardShortcutsDialogContent,
	DefaultMainMenu,
	EditSubmenu,
	Editor,
	ExtrasGroup,
	OfflineIndicator,
	PreferencesGroup,
	ShapeSubmenu,
	TLComponents,
	Tldraw,
	TldrawUiMenuGroup,
	TldrawUiMenuItem,
	ViewSubmenu,
	atom,
	debugFlags,
	lns,
	useActions,
	useValue,
} from 'tldraw'
import { useRemoteSyncClient } from '../hooks/useRemoteSyncClient'
import { UrlStateParams, useUrlState } from '../hooks/useUrlState'
import { assetUrls } from '../utils/assetUrls'
import { MULTIPLAYER_SERVER } from '../utils/config'
import { CursorChatMenuItem } from '../utils/context-menu/CursorChatMenuItem'
import { createAssetFromFile } from '../utils/createAssetFromFile'
import { createAssetFromUrl } from '../utils/createAssetFromUrl'
import { useSharing } from '../utils/sharing'
import { CURSOR_CHAT_ACTION, useCursorChat } from '../utils/useCursorChat'
import { OPEN_FILE_ACTION, SAVE_FILE_COPY_ACTION, useFileSystem } from '../utils/useFileSystem'
import { useHandleUiEvents } from '../utils/useHandleUiEvent'
import { CursorChatBubble } from './CursorChatBubble'
import { DocumentTopZone } from './DocumentName/DocumentName'
import { MultiplayerFileMenu } from './FileMenu'
import { Links } from './Links'
import { PeopleMenu } from './PeopleMenu/PeopleMenu'
import { ShareMenu } from './ShareMenu'
import { SneakyOnDropOverride } from './SneakyOnDropOverride'
import { StoreErrorScreen } from './StoreErrorScreen'
import { ThemeUpdater } from './ThemeUpdater/ThemeUpdater'

const shittyOfflineAtom = atom('shitty offline atom', false)

const components: TLComponents = {
	ErrorFallback: ({ error }) => {
		throw error
	},
	ContextMenu: (props) => (
		<DefaultContextMenu {...props}>
			<CursorChatMenuItem />
			<DefaultContextMenuContent />
		</DefaultContextMenu>
	),
	HelpMenu: () => (
		<DefaultHelpMenu>
			<TldrawUiMenuGroup id="help">
				<DefaultHelpMenuContent />
			</TldrawUiMenuGroup>
			<Links />
		</DefaultHelpMenu>
	),
	MainMenu: () => (
		<DefaultMainMenu>
			<MultiplayerFileMenu />
			<EditSubmenu />
			<ShapeSubmenu />
			<ViewSubmenu />
			<ExtrasGroup />
			<PreferencesGroup />
			<Links />
		</DefaultMainMenu>
	),
	KeyboardShortcutsDialog: (props) => {
		const actions = useActions()
		return (
			<DefaultKeyboardShortcutsDialog {...props}>
				<TldrawUiMenuGroup id="shortcuts-dialog.file">
					<TldrawUiMenuItem {...actions[SAVE_FILE_COPY_ACTION]} />
					<TldrawUiMenuItem {...actions[OPEN_FILE_ACTION]} />
				</TldrawUiMenuGroup>
				<DefaultKeyboardShortcutsDialogContent />
				<TldrawUiMenuGroup id="shortcuts-dialog.collaboration">
					<TldrawUiMenuItem {...actions[CURSOR_CHAT_ACTION]} />
				</TldrawUiMenuGroup>
			</DefaultKeyboardShortcutsDialog>
		)
	},
	TopPanel: () => {
		const isOffline = useValue('offline', () => shittyOfflineAtom.get(), [])
		const showDocumentName = useValue('documentName ', () => debugFlags.documentName.get(), [
			debugFlags,
		])
		if (!showDocumentName) {
			if (isOffline) {
				return <OfflineIndicator />
			}
			return null
		}
		return <DocumentTopZone isOffline={isOffline} />
	},
	SharePanel: () => {
		return (
			<div className="tlui-share-zone" draggable={false}>
				<PeopleMenu />
				<ShareMenu />
			</div>
		)
	},
}

export function MultiplayerEditor({
	isReadOnly,
	roomSlug,
}: {
	isReadOnly: boolean
	roomSlug: string
}) {
	const handleUiEvent = useHandleUiEvents()

	const roomId = isReadOnly ? lns(roomSlug) : roomSlug

	const storeWithStatus = useRemoteSyncClient({
		uri: `${MULTIPLAYER_SERVER}/r/${roomId}`,
		roomId,
	})

	const isOffline =
		storeWithStatus.status === 'synced-remote' && storeWithStatus.connectionStatus === 'offline'
	useEffect(() => {
		shittyOfflineAtom.set(isOffline)
	}, [isOffline])

	const sharingUiOverrides = useSharing()
	const fileSystemUiOverrides = useFileSystem({ isMultiplayer: true })
	const cursorChatOverrides = useCursorChat()

	const handleMount = useCallback(
		(editor: Editor) => {
			;(window as any).app = editor
			;(window as any).editor = editor
			editor.updateInstanceState({ isReadonly: isReadOnly })
			editor.registerExternalAssetHandler('file', createAssetFromFile)
			editor.registerExternalAssetHandler('url', createAssetFromUrl)
		},
		[isReadOnly]
	)

	if (storeWithStatus.error) {
		return <StoreErrorScreen error={storeWithStatus.error} />
	}

	return (
		<div className="tldraw__editor">
			<Tldraw
				store={storeWithStatus}
				assetUrls={assetUrls}
				onMount={handleMount}
				overrides={[sharingUiOverrides, fileSystemUiOverrides, cursorChatOverrides]}
				initialState={isReadOnly ? 'hand' : 'select'}
				onUiEvent={handleUiEvent}
				components={components}
				autoFocus
				inferDarkMode
			>
				<UrlStateSync />
				<CursorChatBubble />
				<SneakyOnDropOverride isMultiplayer />
				<ThemeUpdater />
			</Tldraw>
		</div>
	)
}

export function UrlStateSync() {
	const syncViewport = useCallback((params: UrlStateParams) => {
		window.history.replaceState(
			{},
			document.title,
			window.location.pathname + `?viewport=${params.viewport}&page=${params.page}`
		)
	}, [])

	useUrlState(syncViewport)

	return null
}
