import React from 'react';
import { SaathiMessage, ClarificationOption } from '../../engine/saathi/types';
import { SaathiRecommendationCard } from './SaathiRecommendationCard';
import { SaathiSmartBuyCard } from './SaathiSmartBuyCard';
import { SaathiClarificationPrompt } from './SaathiClarificationPrompt';
import { Sparkles, Check, X, ShieldAlert } from 'lucide-react';

interface SaathiMessageItemProps {
  message: SaathiMessage;
  onSelectClarification?: (option: ClarificationOption) => void;
  onConfirmAction?: () => void;
  onCancelAction?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onPlanLook?: (outfit: any) => void;
  onOpenInAtelier?: (outfit: any) => void;
  onShowAlternative?: () => void;
  onAssessPurchase?: () => void;
  onStyleThis?: (item: any) => void;
  isLatest?: boolean;
  disabled?: boolean;
}

function renderEditorialText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const isBullet = /^\s*[-*•]\s+(.*)$/.test(line);
    const content = isBullet ? line.replace(/^\s*[-*•]\s+/, '') : line;

    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      const matchedStr = match[0];
      if (matchedStr.startsWith('**') && matchedStr.endsWith('**')) {
        parts.push(
          <strong key={`${lineIdx}-${match.index}`} className="font-semibold text-(--ink)">
            {matchedStr.slice(2, -2)}
          </strong>
        );
      } else if (matchedStr.startsWith('*') && matchedStr.endsWith('*')) {
        parts.push(
          <em key={`${lineIdx}-${match.index}`} className="italic text-(--ink)/90">
            {matchedStr.slice(1, -1)}
          </em>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    if (isBullet) {
      return (
        <div key={lineIdx} className="flex items-start gap-1.5 my-0.5 ml-1">
          <span className="text-(--burnished-gold) font-bold text-xs select-none">•</span>
          <span className="flex-1">{parts.length > 0 ? parts : content}</span>
        </div>
      );
    }

    return (
      <span key={lineIdx} className="block min-h-[1.1em]">
        {parts.length > 0 ? parts : content || '\u00A0'}
      </span>
    );
  });
}

export const SaathiMessageItem: React.FC<SaathiMessageItemProps> = ({
  message,
  onSelectClarification,
  onConfirmAction,
  onCancelAction,
  onConfirm,
  onCancel,
  onPlanLook,
  onOpenInAtelier,
  onShowAlternative,
  onAssessPurchase,
  onStyleThis,
  isLatest = true,
  disabled = false,
}) => {
  const isUser = message.sender === 'user';
  const handleConfirm = onConfirmAction || onConfirm;
  const handleCancel = onCancelAction || onCancel;

  return (
    <div
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
      data-testid={`saathi-message-${message.id}`}
    >
      <div className="flex items-center gap-1 px-1">
        {!isUser && <Sparkles className="w-3 h-3 text-(--burnished-gold)" />}
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
          {isUser ? 'You' : 'AI Saathi'}
        </span>
      </div>

      <div
        className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed transition-colors ${
          isUser
            ? 'bg-(--ink) text-white rounded-br-xs'
            : 'bg-card border border-(--border) text-(--ink) rounded-bl-xs shadow-2xs'
        }`}
      >
        <div className="space-y-0.5">
          {renderEditorialText(message.text)}
        </div>

        {/* Embedded Domain Recommendation Cards */}
        {message.domainResult?.outfits && message.domainResult.outfits.length > 0 && (
          <SaathiRecommendationCard
            outfit={message.domainResult.outfits[0]}
            onPlanLook={onPlanLook}
            onOpenInAtelier={onOpenInAtelier}
            onShowAlternative={onShowAlternative}
            onAssessPurchase={onAssessPurchase}
            onStyleThis={onStyleThis}
          />
        )}

        {/* Embedded Smart Buy Report Cards */}
        {(message.domainResult?.type === 'PURCHASE_ASSESSMENT' ||
          message.domainResult?.type === 'WARDROBE_GAPS' ||
          message.domainResult?.purchaseAssessment) && (
          <SaathiSmartBuyCard
            report={message.domainResult.gapReport}
            assessment={message.domainResult.purchaseAssessment || message.domainResult.gapReport?.purchaseAssessment}
          />
        )}

        {/* Clarification Request Options */}
        {message.clarification && isLatest && onSelectClarification && (
          <SaathiClarificationPrompt
            clarification={message.clarification}
            onSelectOption={onSelectClarification}
            disabled={disabled}
          />
        )}

        {/* Mutation Confirmation Prompt */}
        {message.confirmation && handleConfirm && handleCancel && (
          <div
            className="mt-3 p-3.5 rounded-xl border border-(--burnished-gold)/30 bg-(--burnished-gold)/5 space-y-2.5"
            role="region"
            aria-label="Action confirmation"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-(--ink)">
              <ShieldAlert className="w-4 h-4 text-(--burnished-gold)" />
              <span>{message.confirmation.title || 'Schedule Look'}</span>
            </div>
            <p className="text-[11px] text-muted">{message.confirmation.description}</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={disabled}
                onClick={handleConfirm}
                className="min-h-11 flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-(--ink) text-white text-xs font-semibold uppercase tracking-wider hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm &amp; Execute</span>
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={handleCancel}
                className="min-h-11 px-4 flex items-center justify-center gap-1 rounded-lg border border-(--border) bg-card text-(--ink) text-xs font-semibold uppercase tracking-wider hover:bg-(--ivory) active:scale-95 disabled:opacity-50 transition-all"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
