import { describe, it, expect } from 'vitest'
import { validateHfUrl, validateBranch, validateColabUrl } from './validation'

describe('validateHfUrl', () => {
  it('accepts a huggingface.co dataset URL', () => {
    expect(validateHfUrl('https://huggingface.co/datasets/user/repo')).toBeNull()
  })

  it('accepts an hf.co URL', () => {
    expect(validateHfUrl('https://hf.co/user/repo')).toBeNull()
  })

  it('rejects a non-HuggingFace host', () => {
    expect(validateHfUrl('https://github.com/user/repo')).toMatch(/HuggingFace/i)
  })

  it('rejects a lookalike domain', () => {
    expect(validateHfUrl('https://huggingface.co.evil.com/user/repo')).toMatch(/HuggingFace/i)
  })

  it('rejects the host appearing only in the path', () => {
    expect(validateHfUrl('https://evil.com/huggingface.co/user/repo')).toMatch(/HuggingFace/i)
  })

  it('rejects a URL without user/repo', () => {
    expect(validateHfUrl('https://huggingface.co/user')).not.toBeNull()
  })

  it('rejects unparseable input', () => {
    expect(validateHfUrl('not a url')).not.toBeNull()
  })
})

describe('validateBranch', () => {
  it('accepts a simple branch', () => {
    expect(validateBranch('anon-v2')).toBeNull()
  })

  it('accepts a branch containing slashes', () => {
    expect(validateBranch('refs/pr/1')).toBeNull()
  })

  it('rejects a blank branch', () => {
    expect(validateBranch('   ')).not.toBeNull()
  })

  it('rejects a parent-directory segment', () => {
    expect(validateBranch('../..')).toMatch(/\.\./)
  })
})

describe('validateColabUrl', () => {
  it('accepts an empty value', () => {
    expect(validateColabUrl('')).toBeNull()
  })

  it('accepts a Colab drive URL', () => {
    expect(validateColabUrl('https://colab.research.google.com/drive/1a2b')).toBeNull()
  })

  it('rejects another host', () => {
    expect(validateColabUrl('https://evil.example.com/nb')).toMatch(/Colab/i)
  })

  it('rejects a lookalike host', () => {
    expect(validateColabUrl('https://colab.research.google.com.evil.com/nb')).toMatch(/Colab/i)
  })
})
