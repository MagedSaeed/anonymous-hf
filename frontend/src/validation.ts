/**
 * Client-side mirrors of the backend validators.
 *
 * These exist for fast feedback only -- the backend re-checks everything,
 * since anything here can be bypassed by calling the API directly.
 * Each returns an error message, or null when the value is acceptable.
 */

const HF_HOSTNAMES = ['huggingface.co', 'www.huggingface.co', 'hf.co', 'www.hf.co']
const COLAB_HOSTNAMES = ['colab.research.google.com', 'colab.google.com']

const HF_URL_ERROR =
  'Not a valid HuggingFace URL. Expected format: https://huggingface.co/datasets/user/repo'

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export function validateHfUrl(url: string): string | null {
  if (!url.trim()) return 'URL is required.'

  const host = hostnameOf(url)
  if (!host || !HF_HOSTNAMES.includes(host)) return HF_URL_ERROR

  const parts = new URL(url).pathname.replace(/^\//, '').replace(/\/$/, '').split('/')
  const withoutPrefix = parts[0] === 'datasets' || parts[0] === 'models' ? parts.slice(1) : parts
  if (withoutPrefix.length < 2 || !withoutPrefix[0] || !withoutPrefix[1]) return HF_URL_ERROR

  return null
}

export function validateBranch(branch: string): string | null {
  const trimmed = branch.trim()
  if (!trimmed) return 'Branch is required.'
  if (trimmed.split('/').includes('..')) return "Branch cannot contain '..'."
  return null
}

export function validateColabUrl(url: string): string | null {
  if (!url.trim()) return null

  const host = hostnameOf(url)
  if (!host || !COLAB_HOSTNAMES.includes(host)) {
    return 'Not a valid Colab URL. Expected a colab.research.google.com link.'
  }

  return null
}
