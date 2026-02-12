export default function GuidelinesPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        Anonymization Guidelines
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
        How to prepare your HuggingFace repository for double-blind review.
      </p>

      {/* Quick steps */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
          Steps
        </h2>
        <ol className="space-y-3">
          {[
            'Go to your HuggingFace repository',
            'Create a new branch (e.g., "anonymous" or "review")',
            'Edit files in the branch to remove identifying information',
            'Come back here and submit the branch URL',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* What to remove */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
          What to remove
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            {
              label: 'Author names',
              detail: 'README, dataset cards, config files',
            },
            {
              label: 'Email addresses',
              detail: 'e.g., contact@institution.edu',
            },
            {
              label: 'Institution names',
              detail: 'Affiliations, lab names',
            },
            {
              label: 'Personal URLs',
              detail: 'Personal websites, lab pages',
            },
            {
              label: 'Self-citations',
              detail: 'DOI references to your own work',
            },
            {
              label: 'Acknowledgments',
              detail: 'Specific grants or lab mentions',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-2.5 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-lg px-3.5 py-2.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
              <div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {item.label}
                </span>
                <span className="text-sm text-slate-400 dark:text-slate-500 ml-1.5">
                  {item.detail}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conference tips */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
          Conference-specific tips
        </h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-0.5">
              ACL / EMNLP / NAACL
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              Remove all self-citations that could identify you. Replace
              with &ldquo;Anonymous (2024)&rdquo;.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-0.5">
              NeurIPS / ICML / ICLR
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              Ensure code comments don&rsquo;t reference your institution.
              Check wandb/tensorboard logs for identifying info.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-0.5">General</h3>
            <p className="text-slate-500 dark:text-slate-400">
              Check git commit history &mdash; consider squashing commits to
              remove author information from commit messages.
            </p>
          </div>
        </div>
      </div>

      {/* Best practices */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
          Best practices
        </h2>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          {[
            'Review every file in your branch before submitting',
            'Check YAML/JSON config files for hidden identifiers',
            'Test your anonymous URL to ensure content is accessible',
            'Set an appropriate expiry date (extend if review takes longer)',
            "Don't modify the anonymous branch during review",
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <svg
                className="w-4 h-4 text-green-500 shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
