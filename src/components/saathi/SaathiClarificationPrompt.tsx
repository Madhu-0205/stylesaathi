import React from 'react';
import { ClarificationRequest, ClarificationOption } from '../../engine/saathi/types';
import { HelpCircle } from 'lucide-react';

interface SaathiClarificationPromptProps {
  clarification: ClarificationRequest;
  onSelectOption?: (option: ClarificationOption) => void;
  onSelect?: (option: ClarificationOption) => void;
  disabled?: boolean;
}

export const SaathiClarificationPrompt: React.FC<SaathiClarificationPromptProps> = ({
  clarification,
  onSelectOption,
  onSelect,
  disabled = false,
}) => {
  const handleSelect = onSelectOption || onSelect;
  return (
    <div
      className="mt-3 p-3.5 rounded-xl border border-(--burnished-gold)/30 bg-(--burnished-gold)/5 space-y-2.5"
      role="region"
      aria-label="Clarification request"
    >
      <div className="flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-(--burnished-gold) mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-(--ink)">{clarification.question}</p>
          {clarification.contextHint && (
            <p className="text-[11px] text-muted mt-0.5">{clarification.contextHint}</p>
          )}
        </div>
      </div>

      {clarification.options && clarification.options.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {clarification.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect?.(opt)}
              className="min-h-11 px-3.5 py-2 rounded-lg text-xs font-medium border border-(--border) bg-card hover:bg-(--ivory) text-(--ink) transition-all active:scale-95 disabled:opacity-50 text-left flex flex-col justify-center shadow-2xs"
            >
              <span className="font-semibold">{opt.label}</span>
              {opt.description && (
                <span className="text-[10px] text-muted">{opt.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
