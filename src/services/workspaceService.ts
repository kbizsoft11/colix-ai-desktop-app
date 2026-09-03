import { SupabaseClient } from '@supabase/supabase-js'

const WORKSPACE_API = 'https://extensions.kbizsoft.com/magicaa-extension/workspace-name.php'

export interface OwnedWorkspace {
  id: string
  name: string
  owner_id: string
}

export interface WorkspaceMember {
  id?: string
  user_id?: string
  email?: string
  name?: string
  role?: string
  status?: string
  joined_at?: string
  joined?: string
  created_at?: string
  user?: { id?: string; email?: string; first_name?: string | null; last_name?: string | null }
}

export interface WorkspaceInvitation {
  id?: string
  email: string
  role?: string
  status?: string
  created_at?: string
  sent_at?: string
}

type WorkspaceListResponse<T> = { success?: boolean; items?: T[]; members?: T[]; invitations?: T[]; data?: T[]; total?: number; pagination?: { total?: number }; message?: string }

async function getWorkspaceList<T>(tab: 'members' | 'invitations', userEmail: string): Promise<{ items: T[]; total: number }> {
  const url = new URL('https://extensions.kbizsoft.com/magicaa-extension/workspace.php')
  url.searchParams.set('tab', tab)
  url.searchParams.set('search', '')
  url.searchParams.set('role', '')
  url.searchParams.set('status', '')
  url.searchParams.set('resource_type', '')
  url.searchParams.set('page', '1')
  url.searchParams.set('per_page', '10')
  const response = await fetch(url.toString(), { headers: { 'X-User-Email': userEmail } })
  if (!response.ok) throw new Error(`Unable to load ${tab} (${response.status})`)
  const result = await response.json() as WorkspaceListResponse<T>
  const items = result.items || result[tab] || result.data || []
  return { items, total: result.pagination?.total ?? result.total ?? items.length }
}

export const workspaceService = {
  async getOwnedWorkspace(client: SupabaseClient, userEmail: string): Promise<OwnedWorkspace> {
    const { data: user, error: userError } = await client
      .from('users')
      .select('id')
      .ilike('email', userEmail)
      .limit(1)
      .maybeSingle()
    if (userError) throw new Error(`Unable to find user profile: ${userError.message}`)
    if (!user) throw new Error(`No public.users row found for ${userEmail}`)

    const { data: workspace, error: workspaceError } = await client
      .from('workspaces')
      .select('id, name, owner_id')
      .eq('owner_id', (user as { id: string }).id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (workspaceError) throw new Error(`Unable to find workspace: ${workspaceError.message}`)
    if (!workspace) throw new Error(`No workspace found for ${userEmail}`)
    return workspace as OwnedWorkspace
  },

  async updateName(userEmail: string, workspaceId: string, name: string): Promise<string> {
    const response = await fetch(WORKSPACE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Email': userEmail },
      body: JSON.stringify({ workspace_id: workspaceId, name }),
    })
    if (!response.ok) throw new Error(`Unable to update workspace name (${response.status})`)
    const result = await response.json() as { success?: boolean; workspace?: { name?: string }; message?: string }
    if (!result.success || !result.workspace?.name) throw new Error(result.message || 'Invalid workspace response')
    return result.workspace.name
  },

  async getMembers(userEmail: string) { return getWorkspaceList<WorkspaceMember>('members', userEmail) },

  async getInvitations(userEmail: string) { return getWorkspaceList<WorkspaceInvitation>('invitations', userEmail) },

  async sendInvitation(userEmail: string, email: string, role: 'viewer' | 'editor' | 'admin'): Promise<void> {
    const response = await fetch('https://extensions.kbizsoft.com/magicaa-extension/send-invitation.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Email': userEmail },
      body: JSON.stringify({ email, role }),
    })
    if (!response.ok) throw new Error(`Unable to send invitation (${response.status})`)
    const result = await response.json() as { success?: boolean; message?: string }
    if (!result.success) throw new Error(result.message || 'Unable to send invitation')
  },
}
