import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  Sliders,
  Trash2,
  TrendingUp,
  Bookmark,
  Calendar,
  Layers,
  Palette,
  Scissors,
  Feather,
  Grid as GridIcon,
  Heart,
  ChevronRight,
  Info,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Compass,
} from 'lucide-react';
import {
  StyleDNAProfile,
  StyleDNANode,
  StyleDNAInsight,
  PreferenceEvidenceSource,
  PreferenceStatus,
} from '../../types';
import { NavTab } from '../navigation/BottomNav';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface StyleDNAStudioProps {
  styleDNA: StyleDNAProfile;
  onConfirmPreference: (
    dimension: 'color' | 'fabric' | 'pattern' | 'fit',
    key: string
  ) => Promise<void>;
  onCorrectPreference: (
    dimension: 'color' | 'fabric' | 'pattern' | 'fit' | 'category' | 'styleFamily' | 'occasion' | 'aesthetic',
    key: string,
    targetAffinity: number
  ) => Promise<void>;
  onRemovePreference: (
    dimension: 'color' | 'fabric' | 'pattern' | 'fit',
    key: string
  ) => Promise<void>;
  onResetLearnedStyle?: () => void;
  onNavigateTab?: (tab: NavTab) => void;
}

type StudioTab = 'overview' | 'aesthetics' | 'colors' | 'silhouettes' | 'fabrics' | 'patterns' | 'occasions';

export const StyleDNAStudio: React.FC<StyleDNAStudioProps> = ({
  styleDNA,
  onConfirmPreference,
  onCorrectPreference,
  onRemovePreference,
  onResetLearnedStyle,
  onNavigateTab,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('overview');
  const [calibratingNode, setCalibratingNode] = useState<StyleDNANode | null>(null);
  const [targetScore, setTargetScore] = useState<number>(0.5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalKnownNodes = [
    ...styleDNA.aesthetics,
    ...styleDNA.colors,
    ...styleDNA.silhouettes,
    ...styleDNA.fabrics,
    ...styleDNA.patterns,
    ...styleDNA.culturalAffinities,
  ].filter((n) => n.status !== 'unknown');

  const confirmedCount = totalKnownNodes.filter((n) => n.isConfirmed || n.status === 'explicit').length;

  const handleOpenCalibrate = (node: StyleDNANode) => {
    setCalibratingNode(node);
    setTargetScore(node.score || 0.5);
  };

  const handleSaveCalibration = async () => {
    if (!calibratingNode) return;
    setIsSubmitting(true);
    try {
      let dimensionKey: 'color' | 'fabric' | 'pattern' | 'fit' | 'category' | 'styleFamily' | 'occasion' | 'aesthetic';
      switch (calibratingNode.dimension) {
        case 'color':
          dimensionKey = 'color';
          break;
        case 'fabric':
          dimensionKey = 'fabric';
          break;
        case 'pattern':
          dimensionKey = 'pattern';
          break;
        case 'silhouette':
          dimensionKey = 'fit';
          break;
        case 'aesthetic':
        case 'cultural':
          dimensionKey = 'aesthetic';
          break;
        case 'occasion':
          dimensionKey = 'occasion';
          break;
        default:
          dimensionKey = 'styleFamily';
          break;
      }

      await onCorrectPreference(dimensionKey, calibratingNode.value, targetScore);
      setCalibratingNode(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderEvidencePill = (source: PreferenceEvidenceSource) => {
    switch (source) {
      case 'worn_history':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <RotateCcw className="h-2.5 w-2.5" />
            <span>Worn History</span>
          </span>
        );
      case 'explicit_declaration':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-(--burnished-gold) bg-(--burnished-gold)/10 px-2 py-0.5 rounded-full">
            <Check className="h-2.5 w-2.5" />
            <span>Explicit Signature</span>
          </span>
        );
      case 'outfit_feedback':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-(--kumkum) bg-(--kumkum)/10 px-2 py-0.5 rounded-full">
            <Heart className="h-2.5 w-2.5" />
            <span>Outfit Feedback</span>
          </span>
        );
      case 'calendar_plan':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full">
            <Calendar className="h-2.5 w-2.5" />
            <span>Planned Look</span>
          </span>
        );
      case 'saved_look':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full">
            <Bookmark className="h-2.5 w-2.5" />
            <span>Saved Look</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted bg-muted/10 px-2 py-0.5 rounded-full">
            <HelpCircle className="h-2.5 w-2.5" />
            <span>Unobserved</span>
          </span>
        );
    }
  };

  const renderStatusBadge = (status: PreferenceStatus, isConfirmed?: boolean) => {
    if (isConfirmed || status === 'explicit') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-(--burnished-gold)/40 bg-(--burnished-gold)/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-(--burnished-gold)">
          <ShieldCheck className="h-2.5 w-2.5" />
          <span>Confirmed</span>
        </span>
      );
    }
    if (status === 'observed') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          <span>Observed</span>
        </span>
      );
    }
    if (status === 'inferred') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-(--ivory) px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-wider text-muted">
          <span>Inferred</span>
        </span>
      );
    }
    if (status === 'contradictory') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-2.5 w-2.5" />
          <span>Contradictory</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-transparent px-2 py-0.5 text-[9.5px] font-normal uppercase tracking-wider text-muted">
        <span>Unknown</span>
      </span>
    );
  };

  const renderNodeCard = (node: StyleDNANode) => {
    const isExplicit = node.isConfirmed || node.status === 'explicit';
    const isUnknown = node.status === 'unknown';
    const canRemove = !isUnknown && (node.dimension === 'color' || node.dimension === 'fabric' || node.dimension === 'pattern' || node.dimension === 'silhouette');
    const canConfirm = !isExplicit && !isUnknown && (node.dimension === 'color' || node.dimension === 'fabric' || node.dimension === 'pattern' || node.dimension === 'silhouette');

    return (
      <div
        key={node.id}
        className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 ${
          isExplicit
            ? 'border-(--burnished-gold)/50 bg-(--ivory) shadow-2xs'
            : isUnknown
            ? 'border-border/60 bg-card/60 opacity-60'
            : 'border-border bg-card hover:border-(--ink)/40'
        }`}
      >
        <div>
          {/* Top row: Status & Evidence */}
          <div className="flex items-center justify-between gap-2 mb-2">
            {renderStatusBadge(node.status, node.isConfirmed)}
            {renderEvidencePill(node.evidenceSource)}
          </div>

          {/* Node Title & Color Swatch (if color) */}
          <div className="flex items-center gap-2 mt-1">
            {node.dimension === 'color' && (
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/15 shadow-2xs shrink-0"
                style={{ backgroundColor: node.value }}
              />
            )}
            <h4 className="font-serif text-sm font-semibold text-(--ink) tracking-tight">
              {node.label}
            </h4>
          </div>

          {node.description && (
            <p className="text-[11px] text-muted mt-1 leading-snug line-clamp-2">
              {node.description}
            </p>
          )}

          {/* Confidence & Score Metrics */}
          {!isUnknown && (
            <div className="mt-3 space-y-1.5 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-muted">Affinity Score</span>
                <span
                  className={`font-semibold ${
                    node.score > 0.2
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : node.score < -0.2
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-(--ink)'
                  }`}
                >
                  {node.score > 0 ? `+${Math.round(node.score * 100)}%` : `${Math.round(node.score * 100)}%`}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    node.score > 0 ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-red-500'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(8, Math.abs(node.score) * 100))}%`,
                    marginLeft: node.score < 0 ? 'auto' : undefined,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted pt-0.5">
                <span>{Math.round(node.confidence * 100)}% Confidence</span>
                <span>{node.sampleCount} signals</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls (User Agency) */}
        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={() => handleOpenCalibrate(node)}
            className="inline-flex min-h-11 items-center gap-1 text-[11px] font-medium text-muted hover:text-(--ink) px-2.5 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors tactile-press"
          >
            <Sliders className="h-3 w-3" />
            <span>Calibrate</span>
          </button>

          <div className="flex items-center gap-1">
            {canConfirm && (
              <button
                type="button"
                onClick={() =>
                  onConfirmPreference(
                    node.dimension === 'silhouette' ? 'fit' : (node.dimension as any),
                    node.value
                  )
                }
                title="Confirm as signature preference"
                className="inline-flex min-h-11 items-center gap-1 text-[11px] font-semibold text-(--burnished-gold) hover:bg-(--burnished-gold)/10 px-2.5 py-1 rounded-lg transition-colors tactile-press"
              >
                <Check className="h-3 w-3" />
                <span>Confirm</span>
              </button>
            )}

            {canRemove && (
              <button
                type="button"
                onClick={() =>
                  onRemovePreference(
                    node.dimension === 'silhouette' ? 'fit' : (node.dimension as any),
                    node.value
                  )
                }
                title="Remove inferred preference"
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors tactile-press"
                aria-label={`Remove ${node.label} from Style DNA`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderInsightIcon = (type: StyleDNAInsight['type']) => {
    switch (type) {
      case 'color_frequency':
        return <Palette className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'silhouette_signature':
        return <Scissors className="h-4 w-4 text-(--burnished-gold)" />;
      case 'underused_gem':
        return <Sparkles className="h-4 w-4 text-(--kumkum)" />;
      case 'occasion_contrast':
        return <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
      case 'emerging_trend':
        return <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  return (
    <section className="rounded-3xl glass-card specular-border p-5 sm:p-6 shadow-2xs space-y-5">
      {/* Studio Header: Editorial Atelier Title */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-border/80 pb-4 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-(--burnished-gold)" />
            <span className="editorial-kicker text-(--kumkum)">
              STYLE DNA · ATELIER INTUITION
            </span>
          </div>
          <h3 className="mt-1 font-serif text-xl sm:text-2xl text-(--ink) font-normal tracking-tight">
            Personal Fashion Intelligence
          </h3>
          <p className="text-xs text-muted mt-0.5 leading-relaxed max-w-xl">
            A mathematically calibrated model of your signature style grounded in physical wear events and diagnostic feedback. You have full agency to inspect, confirm, calibrate, or discard any attribute.
          </p>
        </div>

        {/* Confidence & Calibration Score Pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 bg-(--ivory) border border-border px-3 py-1.5 rounded-2xl shadow-2xs">
          <div className="h-2 w-2 rounded-full bg-(--burnished-gold) animate-pulse" />
          <div className="text-right">
            <div className="text-[11px] font-semibold text-(--ink)">
              {styleDNA.hasSufficientEvidence
                ? `${Math.round(styleDNA.overallConfidence * 100)}% Calibrated`
                : 'Observing Habits'}
            </div>
            <div className="text-[10px] text-muted">
              {`${styleDNA.totalSignalsCount} signals · ${confirmedCount} confirmed`}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Pills across Style DNA Dimensions */}
      <nav aria-label="Style DNA Dimensions" className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`min-h-11 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all select-none tactile-press shrink-0 ${
            activeTab === 'overview'
              ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
              : 'border border-border bg-card text-muted hover:border-(--ink)'
          }`}
        >
          <span>Overview &amp; Insights</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('aesthetics')}
          className={`min-h-11 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all select-none tactile-press shrink-0 ${
            activeTab === 'aesthetics'
              ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
              : 'border border-border bg-card text-muted hover:border-(--ink)'
          }`}
        >
          <span>Aesthetics &amp; Heritage</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('colors')}
          className={`min-h-11 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all select-none tactile-press shrink-0 ${
            activeTab === 'colors'
              ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
              : 'border border-border bg-card text-muted hover:border-(--ink)'
          }`}
        >
          <span>Color Palette</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('silhouettes')}
          className={`min-h-11 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all select-none tactile-press shrink-0 ${
            activeTab === 'silhouettes'
              ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
              : 'border border-border bg-card text-muted hover:border-(--ink)'
          }`}
        >
          <span>Silhouettes &amp; Fits</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fabrics')}
          className={`min-h-11 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all select-none tactile-press shrink-0 ${
            activeTab === 'fabrics'
              ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
              : 'border border-border bg-card text-muted hover:border-(--ink)'
          }`}
        >
          <span>Fabrics &amp; Weaves</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('patterns')}
          className={`min-h-11 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all select-none tactile-press shrink-0 ${
            activeTab === 'patterns'
              ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
              : 'border border-border bg-card text-muted hover:border-(--ink)'
          }`}
        >
          <span>Craft &amp; Patterns</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('occasions')}
          className={`min-h-11 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all select-none tactile-press shrink-0 ${
            activeTab === 'occasions'
              ? 'border border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
              : 'border border-border bg-card text-muted hover:border-(--ink)'
          }`}
        >
          <span>Occasions</span>
        </button>
      </nav>

      {/* TAB CONTENT: Overview & Insights */}
      {activeTab === 'overview' && (
        <div className="space-y-5 animate-fade-in">
          {/* Early Observation Notice if signals < 3 */}
          {!styleDNA.hasSufficientEvidence ? (
            <div className="rounded-2xl border border-dashed border-border bg-(--ivory)/70 p-5 text-center space-y-2">
              <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-(--burnished-gold)/10 text-(--burnished-gold)">
                <Compass className="h-5 w-5" />
              </div>
              <h4 className="font-serif text-base text-(--ink)">
                Your personal style profile is observing early habits
              </h4>
              <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                StyleSaathi requires at least 3 genuine wear records or diagnostic feedback events before generating narrative insights. This guarantees all advice reflects your true physical archive, avoiding premature stereotypes.
              </p>
              <div className="pt-2 text-[11px] font-semibold text-(--burnished-gold)">
                {`${styleDNA.totalSignalsCount} of 3 baseline signals recorded`}
              </div>
            </div>
          ) : (
            /* Evidence-Grounded Fashion Insights */
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                  GROUNDED FASHION INSIGHTS
                </span>
                <span className="text-[10px] text-muted">
                  Empirically generated from physical archive
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {styleDNA.insights.map((insight) => (
                  <div
                    key={insight.id}
                    className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 hover:border-(--ink)/40 transition-all shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-(--ivory) border border-border">
                            {renderInsightIcon(insight.type)}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                            {insight.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-(--burnished-gold)">
                          {Math.round(insight.confidence * 100)}% match
                        </span>
                      </div>

                      <h4 className="font-serif text-sm font-semibold text-(--ink)">
                        {insight.title}
                      </h4>
                      <p className="text-xs text-muted mt-1 leading-relaxed">
                        {insight.evidence}
                      </p>
                    </div>

                    {insight.type === 'underused_gem' && onNavigateTab && (
                      <div className="mt-3 pt-2.5 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onNavigateTab('Dress')}
                          className="w-full min-h-11 text-xs font-semibold uppercase tracking-wider gap-1.5 tactile-press"
                        >
                          <Sparkles className="h-3 w-3 text-(--burnished-gold)" />
                          <span>Style In Dress Me</span>
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Snapshot of Signature Confirmed Preferences */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                SIGNATURE ATTRIBUTES
              </span>
              <span className="text-[10px] text-muted">
                {totalKnownNodes.length} attributes profiled
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {totalKnownNodes
                .filter((n) => n.score > 0.3 || n.isConfirmed)
                .slice(0, 6)
                .map((node) => renderNodeCard(node))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Aesthetics & Heritage */}
      {activeTab === 'aesthetics' && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
              Aesthetic Profiles &amp; Moods
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {styleDNA.aesthetics.map((node) => renderNodeCard(node))}
            </div>
          </div>

          <div className="pt-2 border-t border-border/50">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
              Cultural Heritage &amp; Traditional Contexts
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {styleDNA.culturalAffinities.map((node) => renderNodeCard(node))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Color Palette */}
      {activeTab === 'colors' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
              Colors Observed in Wardrobe &amp; Wear
            </h4>
            <span className="text-[10px] text-muted">Bayesian frequency analysis</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {styleDNA.colors.map((node) => renderNodeCard(node))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Silhouettes & Fits */}
      {activeTab === 'silhouettes' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
              Preferred Cuts &amp; Silhouettes
            </h4>
            <span className="text-[10px] text-muted">Fit geometry &amp; drape</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {styleDNA.silhouettes.map((node) => renderNodeCard(node))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Fabrics & Weaves */}
      {activeTab === 'fabrics' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
              Fabrics, Textures &amp; Weaves
            </h4>
            <span className="text-[10px] text-muted">Natural fibers &amp; breathability</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {styleDNA.fabrics.map((node) => renderNodeCard(node))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Patterns & Crafts */}
      {activeTab === 'patterns' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
              Prints, Weaves &amp; Crafts
            </h4>
            <span className="text-[10px] text-muted">Surface ornamentation</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {styleDNA.patterns.map((node) => renderNodeCard(node))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Occasion Specialization */}
      {activeTab === 'occasions' && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
              Occasion-Specific Silices
            </h4>
            <span className="text-[10px] text-muted">Preserves context isolation</span>
          </div>

          {Object.keys(styleDNA.occasionPreferences).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-center text-xs text-muted">
              No occasion-specific wear events logged yet. Log outfits in Calendar or Dress Me to see your style evolve per occasion.
            </div>
          ) : (
            Object.entries(styleDNA.occasionPreferences).map(([occKey, nodes]) => (
              <div key={occKey} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-(--burnished-gold)" />
                  <h5 className="font-serif text-sm font-semibold capitalize text-(--ink)">
                    {occKey.replace(/_/g, ' ')}
                  </h5>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {nodes.map((node) => renderNodeCard(node))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Reset Style Memory Footer (User Control) */}
      {onResetLearnedStyle && (
        <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted">
            <Info className="h-3.5 w-3.5" />
            <span>Explicit preferences always hold greater authority than observed habits.</span>
          </div>
          <button
            type="button"
            onClick={onResetLearnedStyle}
            className="text-[11px] font-semibold text-(--kumkum) hover:underline cursor-pointer"
          >
            Reset Style Memory
          </button>
        </div>
      )}

      {/* Calibration Modal */}
      {calibratingNode && (
        <Dialog open={true} onOpenChange={(open) => !open && setCalibratingNode(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-(--kumkum)">
                <Sliders className="h-3.5 w-3.5" />
                <span>Calibrate Preference</span>
              </div>
              <DialogTitle className="font-serif text-lg font-normal text-(--ink)">
                {calibratingNode.label}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted">
                Fine-tune how actively StyleSaathi favors or minimizes {calibratingNode.label} in outfit generation and daily recommendations.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <div className="space-y-2">
                {[
                  { label: 'Signature Favorite (+85%)', score: 0.85, desc: 'Heavily prioritize and recommend regularly' },
                  { label: 'Pleasant Preference (+40%)', score: 0.4, desc: 'Favor comfortably when styling outfits' },
                  { label: 'Neutral / Balanced (0%)', score: 0.0, desc: 'No special bias for or against' },
                  { label: 'Avoid / Deprioritize (-60%)', score: -0.6, desc: 'Minimize in recommendations unless requested' },
                ].map((tier) => (
                  <button
                    key={tier.label}
                    type="button"
                    onClick={() => setTargetScore(tier.score)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all min-h-11 ${
                      Math.abs(targetScore - tier.score) < 0.1
                        ? 'border-(--burnished-gold) bg-(--ivory) shadow-2xs'
                        : 'border-border bg-card hover:border-(--ink)'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-(--ink)">{tier.label}</div>
                      <div className="text-[11px] text-muted">{tier.desc}</div>
                    </div>
                    {Math.abs(targetScore - tier.score) < 0.1 && (
                      <Check className="h-4 w-4 text-(--burnished-gold) shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="default"
                onClick={() => setCalibratingNode(null)}
                className="min-h-11 text-xs font-medium"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="default"
                onClick={handleSaveCalibration}
                disabled={isSubmitting}
                className="min-h-11 text-xs font-semibold uppercase tracking-wider shadow-2xs"
              >
                {isSubmitting ? 'Calibrating...' : 'Save Calibration'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
};
