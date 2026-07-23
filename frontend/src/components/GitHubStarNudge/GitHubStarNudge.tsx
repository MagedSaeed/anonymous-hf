import { useState } from 'react'
import { GITHUB_REPO_URL } from './githubStarNudge'

interface GitHubStarNudgeProps {
  /** Called when the user dismisses without visiting the repo.
   *  `dontShowAgain` reflects the checkbox state. */
  onClose: (dontShowAgain: boolean) => void
  /** Called when the user clicks through to the GitHub repo. */
  onGoToRepo: () => void
}

export default function GitHubStarNudge({ onClose, onGoToRepo }: GitHubStarNudgeProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="github-star-nudge-title"
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full shadow-xl">
        <div className="p-5">
          <h2
            id="github-star-nudge-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1.5"
          >
            ⭐ Enjoying Anonymous HuggingFace?
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            If you find this project useful, consider giving it a star on GitHub — it shows your
            trust and helps others discover it too.
          </p>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            Don&apos;t show this again
          </label>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2.5">
          <button onClick={() => onClose(dontShowAgain)} className="btn-secondary text-sm">
            Maybe later
          </button>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onGoToRepo}
            className="btn-primary text-sm"
          >
            View on GitHub ⭐
          </a>
        </div>
      </div>
    </div>
  )
}
