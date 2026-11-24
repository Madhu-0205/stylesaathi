// ============================================================================
// STYLESAATHI 3.0 — SYNC RECOVERY & DEAD-LETTER RESOLUTION MODAL
// Phase 3C.8: User-Controlled Dead-Letter Resolution & Transparency
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  RefreshCw,
  Download,
  Trash2,
  ShieldCheck,
  Check,
  FileText,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { BottomSheet } from '../common/BottomSheet';
import { syncService } from '../../lib/sync/syncService';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import type { SyncMutation } from '../../types';

interface SyncRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getEntityTitle(mutation: SyncMutation): string {
  const p = (mutation as any).payload || {};
  switch (mutation.entityType) {
    case 'wardrobe_item':
      return p.name || 'Wardrobe Item';
    case 'saved_outfit':
      return p.name || p.outfit?.name || 'Saved Outfit';
    case 'calendar_plan':
      return p.date ? `Calendar Plan (${p.date})` : 'Calendar Plan';
    case 'style_preferences':
      return 'Style Preferences & DNA';
    default:
      return 'Unsynchronized Record';
  }
}

function getEntityBadge(entityType: string): string {
  switch (entityType) {
    case 'wardrobe_item':
      return 'Wardrobe Piece';
    case 'saved_outfit':
      return 'Saved Look';
    case 'calendar_plan':
      return 'Calendar Schedule';
    case 'style_preferences':
      return 'Style DNA';
    default:
      return 'System Record';
  }
}

function formatFriendlyError(error: string | null | undefined): string {
  if (!error) return 'Synchronization requires cloud alignment';
  const err = error.toUpperCase();
  if (err.includes('REVISION_REQUIRED') || err.includes('STALE_REVISION')) {
    return 'Cloud update conflict: A newer version exists on another device. Reconciling will safely merge changes.';
  }
  if (err.includes('TOMBSTONE_CONFLICT')) {
    return 'Item was deleted on another device. Reconciling will review the deletion status.';
  }
  if (err.includes('REFERENTIAL_INTEGRITY')) {
    return 'Linked item mismatch: A referenced garment or outfit was updated or moved on another device.';
  }
  if (err.includes('VALIDATION_FAILED')) {
    return 'Format alignment required: Server requested field re-validation.';
  }
  if (err.includes('IDEMPOTENCY_CONFLICT')) {
    return 'Transaction ID collision: Re-submitting with a fresh transaction key will resolve this.';
  }
  return 'Cloud synchronization conflict: Local edit is preserved and ready for safe reconciliation.';
}

export const SyncRecoveryModal: React.FC<SyncRecoveryModalProps> = ({ isOpen, onClose }) => {
  const { unresolvedMutations, deadLetterCount } = useSyncStatus();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [isResolvingAll, setIsResolvingAll] = useState(false);
  const [confirmDiscardId, setConfirmDiscardId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setConfirmDiscardId(null);
      setFeedbackMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleReconcileSingle = async (mutationId: string) => {
    setResolvingId(mutationId);
    setFeedbackMessage(null);
    try {
      const res = await syncService.reconcileAndRetryDeadLetter(mutationId);
      if (res.success) {
        await syncService.processQueue();
        setFeedbackMessage({ type: 'success', text: 'Item safely reconciled and cloud sync queued.' });
      } else {
        setFeedbackMessage({ type: 'error', text: res.error || 'Reconciliation failed.' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Reconciliation error.' });
    } finally {
      setResolvingId(null);
    }
  };

  const handleReconcileAll = async () => {
    setIsResolvingAll(true);
    setFeedbackMessage(null);
    let successCount = 0;
    try {
      const mutations = [...unresolvedMutations];
      for (const m of mutations) {
        const res = await syncService.reconcileAndRetryDeadLetter(m.id);
        if (res.success) successCount++;
      }
      await syncService.processQueue();
      setFeedbackMessage({
        type: 'success',
        text: `Successfully reconciled ${successCount} of ${mutations.length} issue(s).`,
      });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Batch reconciliation error.' });
    } finally {
      setIsResolvingAll(false);
    }
  };

  const handleDiscardSingle = async (mutationId: string) => {
    setFeedbackMessage(null);
    try {
      const discarded = await syncService.discardDeadLetter(mutationId);
      if (discarded) {
        setFeedbackMessage({ type: 'success', text: 'Unsynced change safely discarded.' });
        setConfirmDiscardId(null);
      } else {
        setFeedbackMessage({ type: 'error', text: 'Failed to discard item.' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Error discarding item.' });
    }
  };

  const handleExport = async () => {
    try {
      const exportData = await syncService.exportDeadLetters();
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `stylesaathi-sync-issues-${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setFeedbackMessage({ type: 'success', text: 'Backup downloaded successfully.' });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: 'Failed to export backup: ' + err.message });
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Cloud Sync Resolution">
      <div className="space-y-6 pb-6 text-foreground">
        {/* Editorial Subtitle & Context Banner */}
        <div className="bg-muted/30 border border-border/60 rounded-xl p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-semibold tracking-wide uppercase text-foreground">
              Local Data Integrity Guaranteed
            </h4>
            <p className="text-xs text-muted leading-relaxed">
              Your edits remain 100% preserved on this device. Synchronization was safely paused to protect your records
              from overwriting newer changes made elsewhere. You may reconcile them with the cloud below.
            </p>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedbackMessage && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Unresolved Issues List */}
        {unresolvedMutations.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
              <Check className="h-6 w-6" />
            </div>
            <h4 className="font-serif text-base text-foreground">All Changes Aligned</h4>
            <p className="text-xs text-muted max-w-sm mx-auto">
              There are currently no unresolved synchronization conflicts. All local records match cloud state.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted border-b border-border/40 pb-2">
              <span className="font-medium tracking-wide uppercase text-[10px]">
                {unresolvedMutations.length} Unresolved Issue{unresolvedMutations.length > 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={handleExport}
                className="text-[11px] text-(--burnished-gold) hover:underline flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Backup (JSON)</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-1">
              {unresolvedMutations.map((mutation) => {
                const title = getEntityTitle(mutation);
                const badge = getEntityBadge(mutation.entityType);
                const friendlyReason = formatFriendlyError(mutation.lastError);
                const isResolvingThis = resolvingId === mutation.id;
                const isConfirmingDiscard = confirmDiscardId === mutation.id;

                return (
                  <div
                    key={mutation.id}
                    className="p-3.5 rounded-xl border border-border/70 bg-card/60 space-y-3 transition-colors hover:border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                            {badge}
                          </span>
                          <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                            {title}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted leading-snug pt-1">{friendlyReason}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="h-3 w-3" />
                          <span>Local Edit Intact</span>
                        </span>
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1 text-[10px] text-muted">
                        <Clock className="h-3 w-3" />
                        <span>
                          {mutation.clientTimestamp
                            ? new Date(mutation.clientTimestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Pending'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isConfirmingDiscard ? (
                          <div className="flex items-center gap-2 bg-destructive/10 px-2 py-1 rounded-md">
                            <span className="text-[10px] text-destructive font-medium">Discard change?</span>
                            <button
                              type="button"
                              onClick={() => handleDiscardSingle(mutation.id)}
                              className="text-[10px] font-bold text-destructive hover:underline uppercase"
                            >
                              Yes, Discard
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDiscardId(null)}
                              className="text-[10px] text-muted hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setConfirmDiscardId(mutation.id)}
                              disabled={isResolvingThis || isResolvingAll}
                              className="text-[11px] text-muted hover:text-destructive transition-colors p-1"
                              title="Discard unmerged edit"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReconcileSingle(mutation.id)}
                              disabled={isResolvingThis || isResolvingAll}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-(--burnished-gold) text-white font-medium text-[11px] hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                              {isResolvingThis ? (
                                <>
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                  <span>Reconciling...</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-3 w-3" />
                                  <span>Reconcile & Retry</span>
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {unresolvedMutations.length > 0 && (
          <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="text-xs text-muted hover:text-foreground flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export All</span>
            </button>

            <button
              type="button"
              onClick={handleReconcileAll}
              disabled={isResolvingAll || resolvingId !== null}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-(--burnished-gold) text-white font-medium text-xs shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              {isResolvingAll ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Reconciling All Issues...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reconcile All ({unresolvedMutations.length})</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
