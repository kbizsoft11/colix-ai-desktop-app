import { useEffect, useMemo, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import './App.css'
import LoginScreen from './components/LoginScreen'
import ShortcutForm from './components/ShortcutForm'
import { supabase } from './services/authService'
import { ipcService } from './services/ipcService'
import { shortcutService } from './services/shortcutService'
import { storageManager } from './utils/storageManager'
import { Shortcut, ShortcutFolder, ShortcutInput } from './types/shortcut'
import logo from "./assets/logo.png"

type IconName = 'plus' | 'folder' | 'bolt' | 'search' | 'user' | 'edit' | 'trash' | 'copy' | 'back' | 'grid' | 'book' | 'chevron' | 'logout'

function Icon({ name, size = 17 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string[]> = {
    plus: ['M12 5v14M5 12h14'],
    folder: ['M3 7.5A2.5 2.5 0 015.5 5H10l2 2h6.5A2.5 2.5 0 0121 9.5v7A2.5 2.5 0 0118.5 19h-13A2.5 2.5 0 013 16.5z'],
    bolt: ['m13 2-9 11h7l-1 9 9-12h-7z'],
    search: ['m21 21-4.35-4.35', 'M11 18a7 7 0 110-14 7 7 0 010 14z'],
    user: ['M20 21a8 8 0 00-16 0', 'M12 13a4 4 0 100-8 4 4 0 000 8z'],
    edit: ['m4 16.5-.8 3.3 3.3-.8L18 7.5 15.5 5z', 'm14.5 6 2.5 2.5'],
    trash: ['M4 7h16', 'M10 11v6M14 11v6', 'M9 7V4h6v3', 'M6 7l1 14h10l1-14'],
    copy: ['M8 8V5.5A2.5 2.5 0 0110.5 3h8A2.5 2.5 0 0121 5.5v8a2.5 2.5 0 01-2.5 2.5H16', 'M5.5 8h8A2.5 2.5 0 0116 10.5v8a2.5 2.5 0 01-2.5 2.5h-8A2.5 2.5 0 013 18.5v-8A2.5 2.5 0 015.5 8z'],
    back: ['m15 18-6-6 6-6', 'M9 12h11'],
    grid: ['M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'],
    book: ['M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 004 16.5z', 'M4 16.5A2.5 2.5 0 016.5 14H20'],
    chevron: ['m8 10 4 4 4-4'],
    logout: ['M10 17l5-5-5-5', 'M15 12H3', 'M21 19V5a2 2 0 00-2-2h-5'],
  }
  return <svg className="ui-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name].map((path, index) => <path key={index} d={path} />)}</svg>
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([])
  const [folders, setFolders] = useState<ShortcutFolder[]>([])
  const [activeFolderId, setActiveFolderId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editingData, setEditingData] = useState<ShortcutInput | undefined>()
  const [searchQuery, setSearchQuery] = useState('')
  const [testText, setTestText] = useState('')
  const [isHookActive, setIsHookActive] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [draggedShortcutId, setDraggedShortcutId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; shortcut: Shortcut } | null>(null)
  const [folderDialog, setFolderDialog] = useState<{ mode: 'create' | 'rename'; folderId?: string; name: string } | null>(null)

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const notify = (message: string) => {
    setNotification(message)
    window.setTimeout(() => setNotification(null), 2800)
  }

  useEffect(() => {
    if (!session) return
    const loadedFolders = storageManager.getAllFolders()
    setFolders(loadedFolders)
    setActiveFolderId(loadedFolders[0]?.id || '')

    let cancelled = false
    const loadShortcuts = async () => {
      if (!supabase) return
      try {
        const customUserId = await shortcutService.getProfileUserId(supabase, session.user.email)
        if (cancelled) return
        setProfileUserId(customUserId)
        const loadedShortcuts = await shortcutService.getAll(supabase, customUserId)
        if (cancelled) return
        setShortcuts(loadedShortcuts)
        window.setTimeout(() => startKeyboardHook(loadedShortcuts), 500)
      } catch (error) {
        console.error('Error loading shortcuts from Supabase:', error)
        const details = error as { message?: string; code?: string }
        notify(details.code ? `Unable to load records (${details.code})` : `Unable to load records: ${details.message || 'Supabase request failed'}`)
      }
    }
    void loadShortcuts()
    ipcService.onKeyboardHookReady(setIsHookActive)
    ipcService.onShortcutTriggered(trigger => notify(`Triggered ${trigger}`))
    return () => { cancelled = true }
  }, [session])

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null)
    window.addEventListener('click', closeContextMenu)
    window.addEventListener('blur', closeContextMenu)
    return () => {
      window.removeEventListener('click', closeContextMenu)
      window.removeEventListener('blur', closeContextMenu)
    }
  }, [])

  const startKeyboardHook = async (items: Shortcut[]) => {
    const result = await ipcService.startKeyboardHook(items)
    if (result.success) setIsHookActive(true)
  }

  const activeFolder = folders.find(folder => folder.id === activeFolderId)
  const visibleShortcuts = useMemo(() => shortcuts.filter(shortcut => {
    const inFolder = shortcut.folderId === activeFolderId || (!shortcut.folderId && activeFolderId === folders[0]?.id)
    const query = searchQuery.toLowerCase()
    return inFolder && (!query || shortcut.name.toLowerCase().includes(query) || shortcut.label.toLowerCase().includes(query) || shortcut.content.toLowerCase().includes(query))
  }), [activeFolderId, folders, searchQuery, shortcuts])

  const openCreate = () => {
    setEditingId(null)
    setEditingData(undefined)
    setShowEditor(true)
  }

  const openEdit = (shortcut: Shortcut) => {
    setEditingId(shortcut.id)
    setEditingData({ name: shortcut.name, label: shortcut.label, content: shortcut.content })
    setShowEditor(true)
  }

  const finishEditor = () => {
    setShowEditor(false)
    setEditingId(null)
    setEditingData(undefined)
  }

  const handleSave = async (data: ShortcutInput) => {
    if (!supabase || !session || !profileUserId) return
    try {
      if (editingId) {
        const updated = await shortcutService.update(supabase, profileUserId, editingId, data)
        const next = shortcuts.map(shortcut => shortcut.id === editingId ? updated : shortcut)
        setShortcuts(next)
        void ipcService.updateShortcuts(next)
        notify('Shortcut updated')
      } else {
        const created = await shortcutService.create(supabase, profileUserId, session.user.email, data, activeFolderId || folders[0]?.id)
        const next = [...shortcuts, created]
        setShortcuts(next)
        void ipcService.updateShortcuts(next)
        void startKeyboardHook(next)
        notify('Shortcut created')
      }
      finishEditor()
    } catch (error) {
      console.error('Error saving shortcut to Supabase:', error)
      const details = error as { message?: string; code?: string }
      notify(details.code ? `Unable to save shortcut (${details.code})` : `Unable to save shortcut: ${details.message || 'Supabase request failed'}`)
    }
  }

  const deleteShortcut = async (id: string) => {
    if (!window.confirm('Delete this shortcut?')) return
    if (!supabase || !session || !profileUserId) return
    try {
      await shortcutService.remove(supabase, profileUserId, id)
      const next = shortcuts.filter(shortcut => shortcut.id !== id)
      setShortcuts(next)
      void ipcService.updateShortcuts(next)
      notify('Shortcut deleted')
    } catch (error) {
      console.error('Error deleting shortcut from Supabase:', error)
      notify('Unable to delete shortcut')
    }
  }

  const deleteVisibleShortcuts = async () => {
    if (!visibleShortcuts.length || !window.confirm('Delete all visible shortcuts?')) return
    if (!supabase || !session || !profileUserId) return
    try {
      await Promise.all(visibleShortcuts.map(shortcut => shortcutService.remove(supabase!, profileUserId, shortcut.id)))
    } catch (error) {
      console.error('Error deleting shortcuts from Supabase:', error)
      notify('Unable to delete all shortcuts')
      return
    }
    const deletedIds = new Set(visibleShortcuts.map(shortcut => shortcut.id))
    const next = shortcuts.filter(shortcut => !deletedIds.has(shortcut.id))
    setShortcuts(next)
    void ipcService.updateShortcuts(next)
    notify('Shortcuts deleted')
  }

  const createFolder = () => {
    setFolderDialog({ mode: 'create', name: '' })
  }

  const renameFolder = (folder: ShortcutFolder) => {
    setFolderDialog({ mode: 'rename', folderId: folder.id, name: folder.name })
  }

  const saveFolder = () => {
    const name = folderDialog?.name.trim()
    if (!folderDialog || !name) return
    if (folderDialog.mode === 'create') {
      const folder = storageManager.addFolder(name)
      setFolders(previous => [...previous, folder])
      setActiveFolderId(folder.id)
      notify('Folder created')
    } else if (folderDialog.folderId && storageManager.renameFolder(folderDialog.folderId, name)) {
      setFolders(previous => previous.map(item => item.id === folderDialog.folderId ? { ...item, name } : item))
      notify('Folder renamed')
    }
    setFolderDialog(null)
  }

  const deleteFolder = async (folder: ShortcutFolder) => {
    if (folders.length <= 1 || !window.confirm(`Delete the ${folder.name} folder?`)) return
    const fallback = folders.find(item => item.id !== folder.id)
    if (!fallback) return
    if (supabase && session && profileUserId) {
      try {
        await Promise.all(shortcuts.filter(shortcut => shortcut.folderId === folder.id).map(shortcut => shortcutService.move(supabase!, profileUserId, shortcut.id, fallback.id)))
      } catch (error) {
        console.error('Error moving shortcuts while deleting folder:', error)
        notify('Unable to delete folder')
        return
      }
    }
    storageManager.deleteFolder(folder.id)
    setShortcuts(previous => previous.map(shortcut => shortcut.folderId === folder.id ? { ...shortcut, folderId: fallback.id } : shortcut))
    setFolders(previous => previous.filter(item => item.id !== folder.id))
    setActiveFolderId(fallback.id)
  }

  const moveShortcut = async (folderId: string) => {
    if (!draggedShortcutId || draggedShortcutId === folderId) return
    if (!supabase || !session || !profileUserId) return
    try {
      await shortcutService.move(supabase, profileUserId, draggedShortcutId, folderId)
      setShortcuts(previous => previous.map(shortcut => shortcut.id === draggedShortcutId ? { ...shortcut, folderId } : shortcut))
      notify('Shortcut moved')
    } catch (error) {
      console.error('Error moving shortcut in Supabase:', error)
      notify('Unable to move shortcut')
    }
    setDraggedShortcutId(null)
  }

  const showShortcutContextMenu = (x: number, y: number, shortcut: Shortcut) => {
    setContextMenu({ x, y, shortcut })
  }

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    setProfileUserId(null)
  }

  if (authLoading) {
    return <main className="auth-screen">
      <div className="auth-loading">
        <img className="w-20 h-20 rounded-full" src={logo} alt="ColixAI" />
      </div>
    </main>
  }

  if (!session) return <LoginScreen />

  if (showEditor) {
    return (
      <div className="app-shell">
        <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} email={session.user.email} onLogout={handleLogout} />
        <div className="workspace editor-workspace">
          <Sidebar folders={folders} shortcuts={shortcuts} activeFolderId={activeFolderId} setActiveFolderId={setActiveFolderId} onCreateFolder={createFolder} onRenameFolder={renameFolder} onDeleteFolder={deleteFolder} onCreateShortcut={openCreate} onEdit={openEdit} onDragStart={setDraggedShortcutId} onDrop={moveShortcut} onContextMenu={showShortcutContextMenu} />
          <main className="editor-main"><ShortcutForm key={editingId || 'new'} isEditing={Boolean(editingId)} initialData={editingData} onSubmit={handleSave} onCancel={finishEditor} /></main>
        </div>
        {notification && <div className="toast">{notification}</div>}
        {folderDialog && <FolderDialog dialog={folderDialog} setDialog={setFolderDialog} onSave={saveFolder} />}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} email={session.user.email} onLogout={handleLogout} />
      <div className="workspace">
        <Sidebar folders={folders} shortcuts={shortcuts} activeFolderId={activeFolderId} setActiveFolderId={setActiveFolderId} onCreateFolder={createFolder} onRenameFolder={renameFolder} onDeleteFolder={deleteFolder} onCreateShortcut={openCreate} onEdit={openEdit} onDragStart={setDraggedShortcutId} onDrop={moveShortcut} onContextMenu={showShortcutContextMenu} />
        <main className="dashboard-main">
          <div className="page-heading"><div><h1>{activeFolder?.name || 'My Shortcuts'} <span>{visibleShortcuts.length}</span></h1><p>Type a shortcut below to test it before using it anywhere on your computer.</p></div><button className="button button-danger" onClick={deleteVisibleShortcuts}><Icon name="trash" size={15} /> Delete all</button></div>
          <section className="welcome-card">
            <h2 className="font-mono font-semibold">Welcome to ColixAI</h2>
            <p>Type a shortcut trigger below, such as <code>-ty</code> or <code>@email</code>. It will instantly expand into text.</p>
            <textarea className="test-area" value={testText} onFocus={() => ipcService.setShortcutTestFocused(true)} onBlur={() => ipcService.setShortcutTestFocused(false)} onChange={event => setTestText(event.target.value)} placeholder="Type here to test your shortcuts live... (e.g. -ty)" />
            <p className="helper-text">Your shortcuts work in Notepad, browsers, editors, and other apps while the hook is <strong className={isHookActive ? 'status-online' : 'status-offline'}>{isHookActive ? 'active' : 'inactive'}</strong>.</p>
          </section>
          <section className="quick-actions"><strong>Quick actions:</strong><button className="button button-primary" onClick={openCreate}><Icon name="plus" size={15} /> New shortcut</button><button className="button button-light" onClick={createFolder}><Icon name="folder" size={15} /> New folder</button></section>
          <section className="shortcut-grid">
            {visibleShortcuts.map(shortcut => <article className="shortcut-card" key={shortcut.id} draggable onDragStart={() => setDraggedShortcutId(shortcut.id)}><div className="shortcut-card-top"><span className="bolt"><Icon name="bolt" size={16} /></span><div><h3>{shortcut.label}</h3><code>{shortcut.name}</code></div><button className="icon-button" onClick={() => openEdit(shortcut)} aria-label="Edit shortcut"><Icon name="edit" size={16} /></button></div><p>{shortcut.content}</p><div className="card-actions"><button onClick={() => navigator.clipboard.writeText(shortcut.content).then(() => notify('Copied to clipboard'))}><Icon name="copy" size={14} /> Copy</button><button className="delete-link" onClick={() => deleteShortcut(shortcut.id)}><Icon name="trash" size={14} /> Delete</button></div></article>)}
            {!visibleShortcuts.length && <div className="empty-state"><div className="empty-icon"><Icon name="bolt" /></div><h3>No shortcuts in this folder</h3><p>Create a shortcut or drag one here from another folder.</p><button className="button button-primary" onClick={openCreate}><Icon name="plus" size={15} /> Create shortcut</button></div>}
          </section>
        </main>
        <DocsPanel />
      </div>
      {notification && <div className="toast">{notification}</div>}
      {folderDialog && <FolderDialog dialog={folderDialog} setDialog={setFolderDialog} onSave={saveFolder} />}
      {contextMenu && <div className="shortcut-context-menu" style={{ left: Math.min(contextMenu.x, window.innerWidth - 190), top: Math.min(contextMenu.y, window.innerHeight - 125) }} onClick={event => event.stopPropagation()}><div className="context-menu-title">{contextMenu.shortcut.label}</div><button onClick={() => { openEdit(contextMenu.shortcut); setContextMenu(null) }}><Icon name="edit" size={15} /> Edit shortcut</button><button onClick={() => { void navigator.clipboard.writeText(contextMenu.shortcut.content); notify('Copied to clipboard'); setContextMenu(null) }}><Icon name="copy" size={15} /> Copy content</button><button className="context-delete" onClick={() => { deleteShortcut(contextMenu.shortcut.id); setContextMenu(null) }}><Icon name="trash" size={15} /> Delete shortcut</button></div>}
    </div>
  )
}

function Header({ searchQuery, setSearchQuery, email, onLogout }: { searchQuery: string; setSearchQuery: (value: string) => void; email: string | undefined; onLogout: () => void | Promise<void> }) {
  const initial = email?.trim().charAt(0).toUpperCase() || 'U'
  return <header className="top-header">
    <div className="brand-mark">ColixAI</div>
    <div className="header-actions">
      <div className="header-search">
        <Icon name="search" size={16} />
        <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search shortcuts..." />
      </div>
      <div className="profile-menu-wrap">
        <button className="profile-icon" aria-label="Open profile menu">{initial}</button>
        <div className="profile-menu">
          <div className="profile-menu-email">{email || 'Signed-in user'}</div>
          <button onClick={() => void onLogout()}>
            <Icon name="logout" size={15} /> Logout</button>
        </div>
      </div>
    </div>
  </header>
}

function Sidebar({ folders, shortcuts, activeFolderId, setActiveFolderId, onCreateFolder, onRenameFolder, onDeleteFolder, onCreateShortcut, onEdit, onDragStart, onDrop, onContextMenu }: { folders: ShortcutFolder[]; shortcuts: Shortcut[]; activeFolderId: string; setActiveFolderId: (id: string) => void; onCreateFolder: () => void; onRenameFolder: (folder: ShortcutFolder) => void; onDeleteFolder: (folder: ShortcutFolder) => void; onCreateShortcut: () => void; onEdit: (shortcut: Shortcut) => void; onDragStart: (id: string) => void; onDrop: (folderId: string) => void; onContextMenu: (x: number, y: number, shortcut: Shortcut) => void }) {
  return <aside className="sidebar">
    <div className="sidebar-brand">
      <span className="sidebar-logo">
        <img className="rounded-full" src={logo} alt="ColixAI" />
      </span>
      <strong>ColixAI</strong>
      <div className="sidebar-buttons">
        <button onClick={onCreateShortcut} title="New shortcut">
          <Icon name="plus" />
        </button>
        <button onClick={onCreateFolder} title="New folder">
          <Icon name="folder" size={17} />
        </button>
      </div>
    </div>
    <div className="folder-list">{folders.map(folder => <div key={folder.id} className={`folder-block ${activeFolderId === folder.id ? 'folder-active' : ''}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); onDrop(folder.id) }}>
      <div className="folder-row-wrap">
        <button className="folder-row" onClick={() => setActiveFolderId(folder.id)}>
          <Icon name="chevron" size={15} />
          <span className="folder-icon">
            <Icon name="folder" size={17} />
          </span>
          <strong>{folder.name}</strong>
          <small>{shortcuts.filter(shortcut => shortcut.folderId === folder.id || (!shortcut.folderId && folder === folders[0])).length}</small>
        </button>
        <button className="folder-edit" onClick={() => onRenameFolder(folder)} aria-label="Rename folder">
          <Icon name="edit" size={13} />
        </button>{folders.length > 1 && folder.id !== 'default-folder' && <button className="folder-delete" onClick={() => onDeleteFolder(folder)} aria-label="Delete folder">
          <Icon name="trash" size={13} />
        </button>}
      </div>{activeFolderId === folder.id && <div className="folder-shortcuts">{shortcuts.filter(shortcut => shortcut.folderId === folder.id || (!shortcut.folderId && folder === folders[0])).map(shortcut => <button key={shortcut.id} className="sidebar-shortcut" draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', shortcut.id); onDragStart(shortcut.id) }} onClick={() => onEdit(shortcut)} onContextMenu={event => { event.preventDefault(); onContextMenu(event.clientX, event.clientY, shortcut) }}>
        <span className="shortcut-bolt"><Icon name="bolt" size={14} />
        </span>
        <span className="sidebar-shortcut-label">{shortcut.label}</span>
        <code>{shortcut.name}</code>
      </button>)}
        <div className="drop-hint">Drop here</div>
      </div>}</div>)}
    </div>
    <div className="sidebar-footer"><span className={`hook-dot ${activeFolderId ? 'online' : ''}`}>
    </span>{activeFolderId ? 'Shortcuts ready' : 'Loading shortcuts'}
    </div>
  </aside>
}

function DocsPanel() {
  return <aside className="docs-panel">
    <h2>Want to learn more?</h2>
    <a href="#documentation">
      <span><Icon name="book" /></span>
      <div>
        <strong>ColixAI Documentation</strong>
        <small>Guides and references</small>
      </div>
    </a>
    <a href="#faq">
      <span><Icon name="search" /></span>
      <div>
        <strong>ColixAI FAQ</strong>
        <small>Frequently asked questions</small>
      </div>
    </a>
    <a href="#community">
      <span><Icon name="grid" /></span>
      <div>
        <strong>Community Forums</strong>
        <small>Ask questions and suggest features</small>
      </div>
    </a>
    <a href="#email">
      <span><Icon name="copy" /></span>
      <div>
        <strong>Email the team</strong>
        <small>support@colixai.com</small>
      </div>
    </a>
    <div className="docs-logo">
      <img className="rounded-full" src={logo} alt="ColixAI" />
    </div>
  </aside>
}

function FolderDialog({ dialog, setDialog, onSave }: { dialog: { mode: 'create' | 'rename'; folderId?: string; name: string }; setDialog: (dialog: { mode: 'create' | 'rename'; folderId?: string; name: string } | null) => void; onSave: () => void }) {
  return <div className="dialog-backdrop" onMouseDown={() => setDialog(null)}>
    <form className="folder-dialog" onSubmit={event => { event.preventDefault(); onSave() }} onMouseDown={event => event.stopPropagation()}>
      <h2>{dialog.mode === 'create' ? 'Create folder' : 'Rename folder'}</h2>
      <p>{dialog.mode === 'create' ? 'Organize your shortcuts into a new folder.' : 'Choose a new name for this folder.'}</p>
      <input autoFocus value={dialog.name} onChange={event => setDialog({ ...dialog, name: event.target.value })} placeholder="Folder name" />
      <div className="dialog-actions">
        <button type="button" className="button button-light" onClick={() => setDialog(null)}>Cancel</button>
        <button type="submit" className="button button-primary">{dialog.mode === 'create' ? 'Create folder' : 'Save name'}</button>
      </div>
    </form>
  </div>
}

export default App
