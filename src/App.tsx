import React, { useEffect, useMemo, useState } from 'react'
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
import { richTextToPlainText } from './utils/richText'

import supportReply from "./assets/marketplace/support-reply.png"
import costEstimate from "./assets/marketplace/cost-estimate.png"
import jobApplication from "./assets/marketplace/job-application.png"
import meetingNotes from "./assets/marketplace/meeting-notes.png"
import projectHandover from "./assets/marketplace/project-handover.png"
import medicalForm from "./assets/marketplace/medical-form.png"

const shortcutDisplayName = (shortcut: Shortcut) => shortcut.label.trim() || shortcut.name

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
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void | Promise<void> } | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showMarketplace, setShowMarketplace] = useState(false)
  const [isPasteEnabled, setIsPasteEnabled] = useState(true)

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
    return inFolder && (!query || shortcut.name.toLowerCase().includes(query) || shortcut.label.toLowerCase().includes(query) || richTextToPlainText(shortcut.content).toLowerCase().includes(query))
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
    if (!supabase || !session || !profileUserId) return
    try {
      await shortcutService.remove(supabase, profileUserId, id)
      const next = shortcuts.filter(shortcut => shortcut.id !== id)
      setShortcuts(next)
      void ipcService.updateShortcuts(next)
      if (editingId === id) finishEditor()
      notify('Shortcut deleted')
    } catch (error) {
      console.error('Error deleting shortcut from Supabase:', error)
      notify('Unable to delete shortcut')
    }
  }

  const deleteVisibleShortcuts = async () => {
    if (!visibleShortcuts.length) return
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

  const requestDeleteShortcut = (shortcut: Shortcut) => {
    setConfirmDialog({
      title: 'Delete shortcut?',
      message: `This will permanently remove "${shortcutDisplayName(shortcut)}" from your shortcuts.`,
      confirmLabel: 'Delete shortcut',
      onConfirm: () => deleteShortcut(shortcut.id),
    })
  }

  const requestDeleteVisibleShortcuts = () => {
    if (!visibleShortcuts.length) return
    setConfirmDialog({
      title: 'Delete all visible shortcuts?',
      message: `This will remove ${visibleShortcuts.length} shortcut${visibleShortcuts.length === 1 ? '' : 's'} from this folder.`,
      confirmLabel: 'Delete all',
      onConfirm: deleteVisibleShortcuts,
    })
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
        <img className="w-26 h-26 rounded-full" src={logo} alt="ColixAI" />
      </div>
    </main>
  }

  if (!session) return <LoginScreen />

  if (showMarketplace) {
    return <div className="app-shell">
      <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} email={session.user.email} onLogout={handleLogout} onHome={() => setShowMarketplace(false)} onProfile={() => setShowProfile(true)} onMarketplace={() => setShowMarketplace(true)} />
      <MarketplaceView onBack={() => setShowMarketplace(false)} shortcuts={shortcuts} folders={folders} onSetFolders={setFolders} onAddTemplate={async (data, folderId) => {
        if (!supabase || !session || !profileUserId) return
        try {
          const created = await shortcutService.create(supabase, profileUserId, session.user.email, data, folderId || activeFolderId || folders[0]?.id)
          const next = [...shortcuts, created]
          setShortcuts(next)
          void ipcService.updateShortcuts(next)
          void startKeyboardHook(next)
        } catch (error) {
          console.error('Error adding template:', error)
          throw error
        }
      }} notify={notify} />
      {notification && <div className="toast">{notification}</div>}
    </div>
  }

  if (showProfile) {
    return <div className="app-shell">
      <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} email={session.user.email} onLogout={handleLogout} onHome={() => setShowProfile(false)} onProfile={() => setShowProfile(true)} onMarketplace={() => setShowMarketplace(true)} />
      <ProfileView session={session} onBack={() => setShowProfile(false)} onSaved={updatedSession => setSession(updatedSession)} notify={notify} />
      {notification && <div className="toast">{notification}</div>}
    </div>
  }

  if (showEditor) {
    return (
      <div className="app-shell">
        <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} email={session.user.email} onLogout={handleLogout} onHome={finishEditor} onProfile={() => setShowProfile(true)} onMarketplace={() => setShowMarketplace(true)} />
        <div className="workspace editor-workspace">
          <Sidebar folders={folders} shortcuts={shortcuts} activeFolderId={activeFolderId} setActiveFolderId={setActiveFolderId} onCreateFolder={createFolder} onRenameFolder={renameFolder} onDeleteFolder={deleteFolder} onCreateShortcut={openCreate} onEdit={openEdit} onDragStart={setDraggedShortcutId} onDrop={moveShortcut} onContextMenu={showShortcutContextMenu} />
          <main className="editor-main"><ShortcutForm key={editingId || 'new'} isEditing={Boolean(editingId)} initialData={editingData} availableShortcuts={shortcuts} currentShortcutId={editingId} onSubmit={handleSave} onCancel={finishEditor} /></main>
        </div>
        {notification && <div className="toast">{notification}</div>}
        {folderDialog && <FolderDialog dialog={folderDialog} setDialog={setFolderDialog} onSave={saveFolder} />}
        {contextMenu && <div className="shortcut-context-menu" style={{ left: Math.min(contextMenu.x, window.innerWidth - 190), top: Math.min(contextMenu.y, window.innerHeight - 125) }} onClick={event => event.stopPropagation()}><div className="context-menu-title">{shortcutDisplayName(contextMenu.shortcut)}</div><button onClick={() => { openEdit(contextMenu.shortcut); setContextMenu(null) }}><Icon name="edit" size={15} /> Edit shortcut</button><button onClick={() => { void ipcService.copyRichText(contextMenu.shortcut.content); notify('Copied to clipboard'); setContextMenu(null) }}><Icon name="copy" size={15} /> Copy content</button><button className="context-delete" onClick={() => { requestDeleteShortcut(contextMenu.shortcut); setContextMenu(null) }}><Icon name="trash" size={15} /> Delete shortcut</button></div>}
        {confirmDialog && <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} email={session.user.email} onLogout={handleLogout} onHome={() => undefined} onProfile={() => setShowProfile(true)} onMarketplace={() => setShowMarketplace(true)} />
      <div className="workspace">
        <Sidebar folders={folders} shortcuts={shortcuts} activeFolderId={activeFolderId} setActiveFolderId={setActiveFolderId} onCreateFolder={createFolder} onRenameFolder={renameFolder} onDeleteFolder={deleteFolder} onCreateShortcut={openCreate} onEdit={openEdit} onDragStart={setDraggedShortcutId} onDrop={moveShortcut} onContextMenu={showShortcutContextMenu} />
        <main className="dashboard-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontWeight: 500, color: '#142033', fontSize: '14px' }}>Paste Functionality</label>
              <button
                onClick={() => {
                  setIsPasteEnabled(!isPasteEnabled)
                  void ipcService.togglePaste(!isPasteEnabled)
                }}
                style={{
                  width: '48px',
                  height: '28px',
                  borderRadius: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: isPasteEnabled ? '#10b981' : '#d1d5db',
                  transition: 'background-color 0.2s',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: isPasteEnabled ? '26px' : '2px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '12px',
                    backgroundColor: 'white',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }}
                />
              </button>
              <span style={{ fontSize: '13px', color: '#6b7280', marginLeft: '4px' }}>
                {isPasteEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
          <div className="page-heading"><div><h1>{activeFolder?.name || 'My Shortcuts'} <span>{visibleShortcuts.length}</span></h1><p>Type a shortcut below to test it before using it anywhere on your computer.</p></div><button className="button button-danger" onClick={requestDeleteVisibleShortcuts}><Icon name="trash" size={15} /> Delete all</button></div>
          <section className="welcome-card">
            <h2 className="font-mono font-semibold">Welcome to ColixAI</h2>
            <p>Type a shortcut trigger below, such as <code>-ty</code> or <code>@email</code>. It will instantly expand into text.</p>
            <textarea className="test-area" value={testText} onFocus={() => ipcService.setShortcutTestFocused(true)} onBlur={() => ipcService.setShortcutTestFocused(false)} onChange={event => setTestText(event.target.value)} placeholder="Type here to test your shortcuts live... (e.g. -ty)" />
            <p className="helper-text">Your shortcuts work in Notepad, browsers, editors, and other apps while the hook is <strong className={isHookActive ? 'status-online' : 'status-offline'}>{isHookActive ? 'active' : 'inactive'}</strong>.</p>
          </section>
          <section className="quick-actions"><strong>Quick actions:</strong><button className="button button-primary" onClick={openCreate}><Icon name="plus" size={15} /> New shortcut</button><button className="button button-light" onClick={createFolder}><Icon name="folder" size={15} /> New folder</button></section>
          <section className="shortcut-grid">
            {visibleShortcuts.map(shortcut => <article className="shortcut-card" key={shortcut.id} draggable onDragStart={() => setDraggedShortcutId(shortcut.id)}><div className="shortcut-card-top"><span className="bolt"><Icon name="bolt" size={16} /></span><div><h3>{shortcutDisplayName(shortcut)}</h3><code>{shortcut.name}</code></div><button className="icon-button" onClick={() => openEdit(shortcut)} aria-label="Edit shortcut"><Icon name="edit" size={16} /></button></div><p>{richTextToPlainText(shortcut.content)}</p><div className="card-actions"><button onClick={() => ipcService.copyRichText(shortcut.content).then(() => notify('Copied to clipboard'))}><Icon name="copy" size={14} /> Copy</button><button className="delete-link" onClick={() => requestDeleteShortcut(shortcut)}><Icon name="trash" size={14} /> Delete</button></div></article>)}
            {!visibleShortcuts.length && <div className="empty-state"><div className="empty-icon"><Icon name="bolt" /></div><h3>No shortcuts in this folder</h3><p>Create a shortcut or drag one here from another folder.</p><button className="button button-primary" onClick={openCreate}><Icon name="plus" size={15} /> Create shortcut</button></div>}
          </section>
        </main>
        <DocsPanel />
      </div>
      {notification && <div className="toast">{notification}</div>}
      {folderDialog && <FolderDialog dialog={folderDialog} setDialog={setFolderDialog} onSave={saveFolder} />}
      {contextMenu && <div className="shortcut-context-menu" style={{ left: Math.min(contextMenu.x, window.innerWidth - 190), top: Math.min(contextMenu.y, window.innerHeight - 125) }} onClick={event => event.stopPropagation()}><div className="context-menu-title">{shortcutDisplayName(contextMenu.shortcut)}</div><button onClick={() => { openEdit(contextMenu.shortcut); setContextMenu(null) }}><Icon name="edit" size={15} /> Edit shortcut</button><button onClick={() => { void ipcService.copyRichText(contextMenu.shortcut.content); notify('Copied to clipboard'); setContextMenu(null) }}><Icon name="copy" size={15} /> Copy content</button><button className="context-delete" onClick={() => { requestDeleteShortcut(contextMenu.shortcut); setContextMenu(null) }}><Icon name="trash" size={15} /> Delete shortcut</button></div>}
      {confirmDialog && <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />}
    </div>
  )
}

function Header({ searchQuery, setSearchQuery, email, onLogout, onHome, onProfile, onMarketplace }: { searchQuery: string; setSearchQuery: (value: string) => void; email: string | undefined; onLogout: () => void | Promise<void>; onHome: () => void; onProfile: () => void; onMarketplace: () => void }) {
  const initial = email?.trim().charAt(0).toUpperCase() || 'U'
  return <header className="top-header">
    <button className="brand-mark" onClick={onHome} aria-label="Go to shortcuts home">
      <div className="flex justify-center items-center gap-3">
        <img className="w-12 h-12 rounded-full" src={logo} alt="ColixAI" />
       <span className="tracking-wide leading-0 text-white">ColixAI</span>
      </div>
    </button>
    <div className='flex justify-center items-center'>
      <button onClick={onMarketplace} className='text-white hover:opacity-78 bg-transparent border-0 cursor-pointer'>Marketplace</button>
    </div>
    <div className="header-actions">
      <div className="header-search">
        <Icon name="search" size={16} />
        <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search shortcuts..." />
      </div>
      <div className="profile-menu-wrap">
        <button className="profile-icon" aria-label="Open profile menu">{initial}</button>
        <div className="profile-menu">
          <div className="profile-menu-email">{email || 'Signed-in user'}</div>
          <button className="profile-menu-link" onClick={onProfile}>
            <Icon name="user" size={15} /> Profile
          </button>
          <button onClick={() => void onLogout()}>
            <Icon name="logout" size={15} /> Logout</button>
        </div>
      </div>
    </div>
  </header>
}

function ProfileView({ session, onBack, onSaved, notify }: { session: Session; onBack: () => void; onSaved: (session: Session) => void; notify: (message: string) => void }) {
  const metadata = session.user.user_metadata as { first_name?: string; last_name?: string }
  const [firstName, setFirstName] = useState(metadata.first_name || '')
  const [lastName, setLastName] = useState(metadata.last_name || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (password && password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!supabase) return
    setIsSaving(true)
    const update: { data: { first_name: string; last_name: string }; password?: string } = { data: { first_name: firstName.trim(), last_name: lastName.trim() } }
    if (password) update.password = password
    const { data, error: updateError } = await supabase.auth.updateUser(update)
    setIsSaving(false)
    if (updateError || !data.user) {
      setError(updateError?.message || 'Unable to update profile.')
      return
    }
    onSaved({ ...session, user: data.user })
    setPassword('')
    setConfirmPassword('')
    notify('Profile updated')
  }

  return <main className="profile-main">
    <section className="profile-card">
      <div className="profile-heading"><div><button type="button" className="back-button" onClick={onBack}>← Back</button><h1>Profile</h1><p>Update your name and password.</p></div><div className="profile-avatar">{(firstName || session.user.email || 'U').charAt(0).toUpperCase()}</div></div>
      <form className="profile-form" onSubmit={saveProfile}>
        <div className="profile-section"><h2>Personal details</h2><label>First name<input value={firstName} onChange={event => setFirstName(event.target.value)} placeholder="First name" /></label><label>Last name<input value={lastName} onChange={event => setLastName(event.target.value)} placeholder="Last name" /></label><label>Email<input value={session.user.email || ''} readOnly /></label></div>
        <div className="profile-section"><h2>Change password</h2><p className="profile-muted">Leave these fields empty to keep your current password.</p><label>New password<input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="New password" autoComplete="new-password" /></label><label>Confirm password<input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Confirm new password" autoComplete="new-password" /></label></div>
        {error && <p className="profile-error" role="alert">{error}</p>}
        <div className="profile-actions"><button type="button" className="button button-light" onClick={onBack}>Cancel</button><button type="submit" className="button button-primary" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save changes'}</button></div>
      </form>
    </section>
  </main>
}

function Sidebar({ folders, shortcuts, activeFolderId, setActiveFolderId, onCreateFolder, onRenameFolder, onDeleteFolder, onCreateShortcut, onEdit, onDragStart, onDrop, onContextMenu }: { folders: ShortcutFolder[]; shortcuts: Shortcut[]; activeFolderId: string; setActiveFolderId: (id: string) => void; onCreateFolder: () => void; onRenameFolder: (folder: ShortcutFolder) => void; onDeleteFolder: (folder: ShortcutFolder) => void; onCreateShortcut: () => void; onEdit: (shortcut: Shortcut) => void; onDragStart: (id: string) => void; onDrop: (folderId: string) => void; onContextMenu: (x: number, y: number, shortcut: Shortcut) => void }) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!activeFolderId) return
    setExpandedFolders(previous => new Set(previous).add(activeFolderId))
  }, [activeFolderId])

  const toggleFolder = (folderId: string) => {
    if (activeFolderId !== folderId) {
      setActiveFolderId(folderId)
      setExpandedFolders(previous => new Set(previous).add(folderId))
      return
    }
    setExpandedFolders(previous => {
      const next = new Set(previous)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

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
        <button className="folder-row" onClick={() => toggleFolder(folder.id)} aria-expanded={expandedFolders.has(folder.id)}>
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
      </div>{expandedFolders.has(folder.id) && <div className="folder-shortcuts">{shortcuts.filter(shortcut => shortcut.folderId === folder.id || (!shortcut.folderId && folder === folders[0])).map(shortcut => <button key={shortcut.id} className="sidebar-shortcut" draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', shortcut.id); onDragStart(shortcut.id) }} onClick={() => onEdit(shortcut)} onContextMenu={event => { event.preventDefault(); onContextMenu(event.clientX, event.clientY, shortcut) }}>
        <span className="shortcut-bolt"><Icon name="bolt" size={14} />
        </span>
        <span className="sidebar-shortcut-label">{shortcutDisplayName(shortcut)}</span>
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

function ConfirmDialog({ dialog, onClose }: { dialog: { title: string; message: string; confirmLabel: string; onConfirm: () => void | Promise<void> }; onClose: () => void }) {
  const confirm = async () => {
    await dialog.onConfirm()
    onClose()
  }

  return <div className="dialog-backdrop" onMouseDown={onClose}>
    <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={event => event.stopPropagation()}>
      <div className="confirm-icon"><Icon name="trash" size={19} /></div>
      <h2 id="confirm-title">{dialog.title}</h2>
      <p>{dialog.message}</p>
      <div className="dialog-actions">
        <button type="button" className="button button-light" onClick={onClose}>Cancel</button>
        <button type="button" className="button button-danger confirm-delete" onClick={() => void confirm()}>{dialog.confirmLabel}</button>
      </div>
    </section>
  </div>
}

interface MarketplaceTemplate {
  id: string
  img: string
  label: string
  trigger: string
  category: string
  description: string
  icon: IconName
  content: string
  preview: string[]
}

function MarketplaceView({ onBack, shortcuts, folders, onSetFolders, onAddTemplate, notify }: { onBack: () => void; shortcuts: Shortcut[]; folders: ShortcutFolder[]; onSetFolders: (folders: ShortcutFolder[]) => void; onAddTemplate: (template: ShortcutInput, folderId?: string) => Promise<void>; notify: (message: string) => void }) {
  const templates: MarketplaceTemplate[] = [
    {
      id: 'medical-form',
      img: medicalForm,
      label: 'Medical Intake Form',
      trigger: '-medical-form',
      category: 'HEALTHCARE',
      description: 'Patient intake form with fields for patient name, concerns, visit type, and consent.',
      icon: 'bolt',
      preview: ['Patient: [Full Name]', 'Age: [Dropdown: 18-30 / 30-50 / 50+]', 'Concern: [Describe your main concern]', 'Visit type: [Dropdown: New patient / Follow-up / Annual checkup]', 'Insurance: [Radio: Yes / No]', 'Consent: [Radio: Agree / Decline]'],
      content: '<p><strong>Patient:</strong> <span class="dynamic-field" contenteditable="false" data-field-label="Patient" data-field-default="[Full Name]">Patient</span></p><p><strong>Age Group:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="dropdown" data-field-label="Age Group" data-field-options="%5B%2218-30%22%2C%2230-50%22%2C%2250%2B%22%5D">Age Group</span></p><p><strong>Concern:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="paragraph" data-field-label="Concern" data-field-default="[Describe your main concern]">Concern</span></p><p><strong>Visit type:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="dropdown" data-field-label="Visit type" data-field-options="%5B%22New%20patient%22%2C%22Follow-up%22%2C%22Annual%20checkup%22%5D">Visit type</span></p><p><strong>Has Insurance:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="radio" data-field-label="Insurance" data-field-options="%5B%22Yes%22%2C%22No%22%5D">Insurance</span></p><p><strong>Consent:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="radio" data-field-label="Consent" data-field-options="%5B%22I%20agree%22%2C%22I%20decline%22%5D">Consent</span></p>',
    },
    {
      id: 'support-reply',
      img: supportReply,
      label: 'Customer Support Reply',
      trigger: '-support-reply',
      category: 'SUPPORT',
      description: 'Professional customer support response template with issue summary and resolution.',
      icon: 'book',
      preview: ['Customer Name: [Name]', 'Issue Type: [Dropdown: Bug / Feature Request / General]', 'Issue Summary: [Describe the issue]', 'Resolution: [Provide solution]', 'Priority: [Dropdown: Low / Medium / High / Urgent]', 'Resolved: [Radio: Yes / No]'],
      content: '<p>Hi <span class="dynamic-field" contenteditable="false" data-field-label="Customer Name" data-field-default="[Name]">Customer Name</span>,</p><p>Thank you for contacting us. <strong>Issue Type:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="dropdown" data-field-label="Issue Type" data-field-options="%5B%22Bug%22%2C%22Feature%20Request%22%2C%22General%20Inquiry%22%5D">Issue Type</span></p><p><strong>Summary:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="paragraph" data-field-label="Issue Summary" data-field-default="[Describe the issue]">Issue Summary</span></p><p><strong>Resolution:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="paragraph" data-field-label="Resolution" data-field-default="[Provide solution]">Resolution</span></p><p><strong>Priority:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="dropdown" data-field-label="Priority" data-field-options="%5B%22Low%22%2C%22Medium%22%2C%22High%22%2C%22Urgent%22%5D">Priority</span></p><p><strong>Status:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="radio" data-field-label="Resolved" data-field-options="%5B%22Resolved%22%2C%22Pending%22%5D">Resolved</span></p><p>Best regards,<br>Support Team</p>',
    },
    {
      id: 'meeting-notes',
      img: meetingNotes,
      label: 'Meeting Notes',
      trigger: '-meeting-notes',
      category: 'PRODUCTIVITY',
      description: 'Structured meeting notes template with attendees, agenda, and action items.',
      icon: 'book',
      preview: ['Meeting Date: [Date]', 'Meeting Type: [Dropdown: Standup / Planning / Review / Other]', 'Attendees: [Names]', 'Agenda: [Topics discussed]', 'Key Decisions: [Decisions made]', 'Follow-up Required: [Radio: Yes / No]', 'Action Items: [Who does what by when]'],
      content: '<p><strong>Meeting Date:</strong> <span class="dynamic-field" contenteditable="false" data-field-label="Date" data-field-default="[Date]">Date</span></p><p><strong>Meeting Type:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="dropdown" data-field-label="Meeting Type" data-field-options="%5B%22Standup%22%2C%22Planning%22%2C%22Review%22%2C%22Other%22%5D">Meeting Type</span></p><p><strong>Attendees:</strong> <span class="dynamic-field" contenteditable="false" data-field-label="Attendees" data-field-default="[Names]">Attendees</span></p><p><strong>Agenda:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="paragraph" data-field-label="Agenda" data-field-default="[Topics discussed]">Agenda</span></p><p><strong>Key Decisions:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="paragraph" data-field-label="Decisions" data-field-default="[Decisions made]">Decisions</span></p><p><strong>Follow-up Required:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="radio" data-field-label="Follow-up" data-field-options="%5B%22Yes%22%2C%22No%22%5D">Follow-up</span></p><p><strong>Action Items:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="paragraph" data-field-label="Action Items" data-field-default="[Who does what by when]">Action Items</span></p>',
    },
    {
      id: 'project-handover',
      img: projectHandover,
      label: 'Project Handover',
      trigger: '-project-handover',
      category: 'PROJECTS',
      description: 'Project handover checklist with deliverables, documentation, and next steps.',
      icon: 'grid',
      preview: ['Project Name: [Project title]', 'Status: [Complete / 90% Complete / In Progress]', 'Deliverables: [List of deliverables]', 'Documentation: [Links or descriptions]', 'Next Steps: [Future work]', 'Owner: [Name]'],
      content: '<p><strong>Project Name:</strong> <span class="dynamic-field" contenteditable="false" data-field-label="Project Name" data-field-default="[Project title]">Project Name</span></p><p><strong>Completion Status:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="dropdown" data-field-label="Status" data-field-options="%5B%22Complete%22%2C%2290%25%20Complete%22%2C%22In Progress%22%5D">Status</span></p><p><strong>Deliverables:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="paragraph" data-field-label="Deliverables" data-field-default="[List of deliverables]">Deliverables</span></p><p><strong>Documentation:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="paragraph" data-field-label="Documentation" data-field-default="[Links or descriptions]">Documentation</span></p><p><strong>Next Steps:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="paragraph" data-field-label="Next Steps" data-field-default="[Future work]">Next Steps</span></p><p><strong>Handover Owner:</strong> <span class="dynamic-field" contenteditable="false" data-field-label="Owner" data-field-default="[Name]">Owner</span></p>',
    },
    {
      id: 'cost-estimate',
      img: costEstimate,
      label: 'Simple Cost Estimate',
      trigger: '-cost-estimate',
      category: 'BUSINESS',
      description: 'Quick cost estimate template for projects or services with line items and totals.',
      icon: 'copy',
      preview: ['Client: [Client]', 'Project: [Project description]', 'Currency: [Dropdown: USD / EUR / GBP]', 'Line Items: [Item 1: $X, Item 2: $Y]', 'Subtotal: $[Amount]', 'Tax Rate: [%]', 'Total: $[Amount]', 'Payment Terms: [Radio: Net 30 / Net 60 / Upfront]', 'Valid Until: [Date]'],
      content: '<p><strong>Client:</strong> <span class="dynamic-field" contenteditable="false" data-field-label="Client Name" data-field-default="[Client]">Client Name</span></p><p><strong>Project:</strong> <span class="dynamic-field" contenteditable="false" data-field-label="Project" data-field-default="[Project description]">Project</span></p><p><strong>Currency:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="dropdown" data-field-label="Currency" data-field-options="%5B%22USD%22%2C%22EUR%22%2C%22GBP%22%5D">Currency</span></p><p><strong>Items:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="paragraph" data-field-label="Line Items" data-field-default="[Item 1: $X, Item 2: $Y]">Line Items</span></p><p><strong>Subtotal:</strong> <span class="dynamic-field" contenteditable="false" data-field-label="Subtotal" data-field-default="[Amount]">Subtotal</span></p><p><strong>Tax (%):</strong> <span class="dynamic-field" contenteditable="false" data-field-label="Tax Rate" data-field-default="[%]">Tax Rate</span></p><p><strong>Total:</strong> <span class="dynamic-field" contenteditable="false" data-field-label="Total" data-field-default="[Amount]">Total</span></p><p><strong>Payment Terms:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="radio" data-field-label="Payment Terms" data-field-options="%5B%22Net%2030%22%2C%22Net%2060%22%2C%22Upfront%22%5D">Payment Terms</span></p><p><strong>Valid Until:</strong> <span class="dynamic-field" contenteditable="false" data-field-label="Expiration" data-field-default="[Date]">Expiration</span></p>',
    },
    {
      id: 'job-application',
      img: jobApplication,
      label: 'Job Application Response',
      trigger: '-job-application',
      category: 'HR',
      description: 'Professional response template for job applications and recruitment inquiries.',
      icon: 'book',
      preview: ['Candidate Name: [Full Name]', 'Position: [Job Title]', 'Experience Level: [Dropdown: Entry / Mid / Senior]', 'Application Status: [Dropdown: Accepted / Under Review / Rejected]', 'Strengths: [Describe key strengths]', 'Interview Type: [Radio: Phone / Video / In-Person]', 'Next Steps: [What happens next]', 'Feedback: [Any feedback for candidate]'],
      content: '<p>Dear <span class="dynamic-field" contenteditable="false" data-field-label="Candidate Name" data-field-default="[Full Name]">Candidate Name</span>,</p><p>Thank you for applying for the <span class="dynamic-field" contenteditable="false" data-field-label="Position" data-field-default="[Job Title]">Position</span> role.</p><p><strong>Experience Level:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="dropdown" data-field-label="Experience Level" data-field-options="%5B%22Entry%20Level%22%2C%22Mid%20Level%22%2C%22Senior%20Level%22%5D">Experience Level</span></p><p><strong>Application Status:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="dropdown" data-field-label="Status" data-field-options="%5B%22Accepted%20-%20Interview%20Scheduled%22%2C%22Under%20Review%22%2C%22Not%20Selected%22%5D">Status</span></p><p><strong>Your Strengths:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="paragraph" data-field-label="Strengths" data-field-default="[Key skills and qualities]">Strengths</span></p><p><strong>Interview Format:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="radio" data-field-label="Interview Type" data-field-options="%5B%22Phone%20Call%22%2C%22Video%20Call%22%2C%22In-Person%22%5D">Interview Type</span></p><p><strong>Next Steps:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="paragraph" data-field-label="Next Steps" data-field-default="[Timeline and details]">Next Steps</span></p><p><strong>Additional Feedback:</strong> <span class="dynamic-field" contenteditable="false" data-field-type="paragraph" data-field-label="Feedback" data-field-default="[Optional feedback]">Feedback</span></p><p>Best regards,<br>HR Team</p>',
    },
  ]

  const handleCopyTemplate = async (template: MarketplaceTemplate) => {
    const alreadyOwns = shortcuts.some(s => s.name === template.trigger)
    
    if (alreadyOwns) {
      notify('You already own this template')
      return
    }

    try {
      // Get or create "Imported" folder
      let importedFolder = folders.find(f => f.name === 'Imported')
      if (!importedFolder) {
        importedFolder = storageManager.addFolder('Imported')
        const updatedFolders = storageManager.getAllFolders()
        onSetFolders(updatedFolders)
      }

      // Add template to Imported folder
      await onAddTemplate({
        name: template.trigger,
        label: template.label,
        content: template.content,
      }, importedFolder.id)
      
      notify(`${template.label} added to Imported folder`)
      setTimeout(() => onBack(), 1500)
    } catch (error) {
      console.error('Error adding template:', error)
      notify('Failed to add template')
    }
  }

  return <main className="marketplace-main">
    <div className="marketplace-header">
      <div>
        <button type="button" className="back-button" onClick={onBack}>← Back</button>
        <h1>Marketplace</h1>
        <p>Discover and copy pre-built templates to your shortcuts.</p>
      </div>
    </div>

    <section className="marketplace-grid">
      {templates.map(template => (
        <article key={template.id} className="marketplace-card">
          <div className='w-full h-50 overflow-hidden mb-4'>
            <img className='w-full h-full rounded-lg' src={template.img} alt="medical-foem" />
          </div>
          {/* <div className="marketplace-badge">{template.category}</div> */}
          {/* <div className="marketplace-icon"><Icon name={template.icon} size={32} /></div> */}
          <h3 className='pl-1'>{template.label}</h3>
          {/* <p>{template.description}</p> */}
          <div className="marketplace-trigger">
            <code>{template.trigger}</code>
          </div>
          <div className="marketplace-preview">
            {template.preview.map((line, index) => (
              <div key={index} className="preview-line">{line}</div>
            ))}
          </div>
          <button 
            className="button button-primary marketplace-btn"
            onClick={() => handleCopyTemplate(template)}
          >
            Import template
          </button>
        </article>
      ))}
    </section>
  </main>
}

export default App
