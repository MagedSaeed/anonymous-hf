export interface User {
  id: number
  username: string
  email: string
  hf_id: string
  hf_username: string
  avatar_url: string
  default_expiry_days: number
  date_joined: string
  has_hf_token: boolean
  hf_api_token: string
}

export interface AnonymousRepo {
  id: number
  owner: number
  repo_type: 'dataset' | 'model'
  original_url: string
  branch: string
  anonymous_id: string
  anonymous_url: string
  status: 'active' | 'expired' | 'deleted'
  created_at: string
  updated_at: string
  expires_at: string
  visitor_views: number
  visitor_downloads: number
  days_until_expiry: number
  is_expired: boolean
  allow_download: boolean
  colab_url: string
}

export interface RepoInfo {
  anonymous_id: string
  repo_type: 'dataset' | 'model'
  branch: string
  status: string
  created_at: string
  expires_at: string
  allow_download: boolean
  colab_url: string
  identity_revealed?: boolean
  original_url?: string
}

export interface ActivityLog {
  action: string
  actor_type: 'anonymous' | 'non_owner' | 'owner'
  timestamp: string
}

export interface HFRepo {
  repo_id: string
  repo_type: 'model' | 'dataset'
  name: string
  private: boolean
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface TreeEntry {
  type: 'file' | 'directory'
  path: string
  size?: number
  oid?: string
}
