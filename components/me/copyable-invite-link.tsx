"use client";

import { useState } from "react";

type CopyableInviteLinkProps = {
  url: string;
};

export function CopyableInviteLink({ url }: CopyableInviteLinkProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.getElementById(
        "coach-invite-link-input"
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
      <input
        id="coach-invite-link-input"
        type="text"
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="w-full min-w-0 flex-1 rounded-xl border border-brand-blue/40 bg-white px-3 py-2 font-mono text-xs text-slate-800 sm:text-sm"
        aria-label="Link invito allenatore"
      />
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        {copied ? "Copiato" : "Copia link"}
      </button>
    </div>
  );
}
