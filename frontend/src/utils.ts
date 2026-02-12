/**
 * Extract the repo ID (e.g. "username/repo-name") from a HuggingFace URL.
 */
export function parseRepoId(url: string): string | null {
  try {
    const u = new URL(url)
    const parts = u.pathname.replace(/^\//, '').replace(/\/$/, '').split('/')
    // https://huggingface.co/datasets/user/repo[/tree/branch]
    if (parts[0] === 'datasets' && parts.length >= 3) return `${parts[1]}/${parts[2]}`
    // https://huggingface.co/user/repo[/tree/branch]  (model)
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`
  } catch {
    /* not a valid URL */
  }
  return null
}

/**
 * Build the HuggingFace page URL for a given repo.
 */
export function buildHfUrl(repoType: 'model' | 'dataset', repoId: string): string {
  if (repoType === 'dataset') return `https://huggingface.co/datasets/${repoId}`
  return `https://huggingface.co/${repoId}`
}
