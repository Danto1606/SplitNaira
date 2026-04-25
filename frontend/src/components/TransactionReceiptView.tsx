/**
 * TransactionReceiptView
 *
 * Boundary: pure presentational component.
 * Renders a styled on-chain action receipt (create / deposit / distribute /
 * lock). Owns no state. Extracted from split-app.tsx where it was defined as
 * a nested function inside SplitApp — a React anti-pattern that causes the
 * component to be recreated on every parent render.
 */
"use client";

import { getExplorerUrl, getExplorerLabel } from "@/lib/stellar";

export interface TransactionReceipt {
  hash: string;
  action: "create" | "deposit" | "distribute" | "lock";
  projectId: string;
  title?: string;
  amount?: string;
  round?: number;
}

export function TransactionReceiptView({ receipt, network }: { receipt: TransactionReceipt; network: string | null }) {
  const explorerUrl = getExplorerUrl(receipt.hash, network);
  const explorerLabel = getExplorerLabel(network);

  const actionConfig = {
    create: {
      title: "Project Created Successfully",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      ),
      summary: `Project "${receipt.title}" initialized.`,
    },
    deposit: {
      title: "Deposit Successful",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      ),
      summary: `Deposited ${receipt.amount} tokens to ${receipt.projectId}.`,
    },
    distribute: {
      title: "Distribution Successful",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      ),
      summary: `Round #${receipt.round} completed for ${receipt.projectId}.`,
    },
    lock: {
      title: "Project Locked Permanently",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      ),
      summary: `Configuration for ${receipt.projectId} is now immutable.`,
    },
  }[receipt.action];

  return (
    <div className="mt-8 rounded-2xl border border-greenBright/20 bg-greenBright/5 p-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-start gap-4">
        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-greenBright/10">
          <svg
            className="h-6 w-6 text-greenBright"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            {actionConfig.icon}
          </svg>
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-greenBright uppercase tracking-widest">
            {actionConfig.title}
          </h3>
          <p className="text-[11px] text-muted-foreground font-medium italic opacity-90">
            {actionConfig.summary}
          </p>
          <div className="pt-2 space-y-1">
            <p className="font-mono text-[9px] text-muted break-all opacity-60">
              Tx: {receipt.hash}
            </p>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-greenBright underline underline-offset-4 hover:text-white transition-colors"
            >
              Verify on {explorerLabel}
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
