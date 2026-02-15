import { useState } from 'react'

function lineClass(line: string): string {
  const t = line.trimStart()
  if (t.startsWith('#')) return 'text-emerald-400/70'
  if (t.startsWith('!')) return 'text-amber-300'
  if (t.startsWith('from ') || t.startsWith('import ')) return 'text-sky-300'
  if (t.includes(' = ')) return 'text-violet-300'
  return 'text-slate-200'
}

interface Props {
  code: string
  colabUrl?: string
}

export default function CodeSnippet({ code, colabUrl }: Props) {
  const [copied, setCopied] = useState(false)
  const lines = code.split('\n')

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      {colabUrl && (
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-100 dark:border-slate-700">
          <a
            href={colabUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors"
          >
            <img
              src="https://colab.research.google.com/assets/colab-badge.svg"
              alt="Open in Colab"
              className="h-5"
            />
          </a>
          <span className="text-xs text-slate-400 dark:text-slate-500 italic">
            Author-provided notebook for browsing this repository on Colab
          </span>
        </div>
      )}
      <div className="relative group">
        <button
          onClick={handleCopy}
          className="absolute top-2.5 right-3 text-xs font-medium px-2.5 py-1 rounded-md bg-slate-700/80 text-slate-300 hover:bg-slate-600 hover:text-slate-100 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <pre className="bg-slate-900 py-4 overflow-x-auto text-[13px] font-mono leading-6">
          {lines.map((line, i) => (
            <div key={i} className="flex hover:bg-white/[0.04] px-4">
              <span className="text-slate-600 select-none w-6 shrink-0 text-right mr-4 text-xs leading-6">
                {i + 1}
              </span>
              <span className={lineClass(line)}>{line || ' '}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}
