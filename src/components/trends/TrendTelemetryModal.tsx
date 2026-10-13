import React from 'react';
import { X, ShieldCheck, Clock, CheckCircle2, AlertTriangle, Sparkles, Compass } from 'lucide-react';
import { TrendDiscoveryOpportunity } from '../../engine/trends/types';

export interface TrendTelemetryModalProps {
  opportunity: TrendDiscoveryOpportunity;
  onClose: () => void;
}

export const TrendTelemetryModal: React.FC<TrendTelemetryModalProps> = ({
  opportunity,
  onClose,
}) => {
  const { trend, evidence } = opportunity;
  const { concept, provenance } = trend;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trend-telemetry-title"
    >
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/30">
                <ShieldCheck className="w-3 h-3" />
                VERIFIED PROVENANCE & EVIDENCE
              </span>
              <span className="text-xs font-semibold text-muted">
                Classification: {evidence.classification}
              </span>
            </div>
            <h2
              id="trend-telemetry-title"
              className="mt-1 font-serif text-xl sm:text-2xl font-normal text-(--ink)"
            >
              {concept.name}
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Slug: <code className="text-xs font-mono">{concept.slug}</code>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:bg-muted/20 hover:text-(--ink) transition-colors"
            aria-label="Close telemetry modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dimension 1: Provenance & Trust */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-accent" />
            1. Provenance & Editorial Trust
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-(--ivory)/60 p-3 rounded-xl border border-border">
            <div>
              <span className="text-muted block">Source Type:</span>
              <strong className="text-(--ink)">{provenance.sourceType}</strong>
            </div>
            <div>
              <span className="text-muted block">Source Reference:</span>
              <strong className="text-(--ink)">{provenance.sourceReference}</strong>
            </div>
            <div>
              <span className="text-muted block">Editorial Reviewer:</span>
              <strong className="text-(--ink)">{trend.reviewedBy}</strong>
            </div>
            <div>
              <span className="text-muted block">Review Date:</span>
              <strong className="text-(--ink)">{trend.reviewedAt}</strong>
            </div>
            <div>
              <span className="text-muted block">Policy Trust Weight:</span>
              <strong className="text-(--ink)">{(evidence.provenanceAndTrust.trustWeight * 100).toFixed(0)}%</strong>
              <span className="text-[10px] text-muted block">(Application Policy, not objective truth)</span>
            </div>
            <div>
              <span className="text-muted block">Corroboration Signals:</span>
              <strong className="text-(--ink)">{evidence.temporalFreshness.corroboratingSignalsCount} independent sources</strong>
            </div>
          </div>
        </section>

        {/* Dimension 2: Temporal Freshness & Lifecycle */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-accent" />
            2. Temporal Validity & Freshness
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-(--ivory)/60 p-3 rounded-xl border border-border">
            <div>
              <span className="text-muted block">Lifecycle State:</span>
              <strong className="text-(--ink)">{concept.lifecycleState}</strong>
            </div>
            <div>
              <span className="text-muted block">Valid From:</span>
              <strong className="text-(--ink)">{concept.validFrom}</strong>
            </div>
            <div>
              <span className="text-muted block">Valid Until:</span>
              <strong className="text-(--ink)">{concept.validUntil}</strong>
            </div>
          </div>
        </section>

        {/* Dimension 3: Wardrobe Coverage */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
            3. Personal Wardrobe Coverage
          </h3>
          <div className="space-y-2 text-xs bg-(--ivory)/60 p-3 rounded-xl border border-border">
            <div className="flex justify-between items-center">
              <span>Direct Matching Pieces:</span>
              <strong className="text-(--ink)">{evidence.wardrobeCoverage.directMatchesCount} owned</strong>
            </div>
            <div className="flex justify-between items-center">
              <span>Structural Substitutes:</span>
              <strong className="text-(--ink)">{evidence.wardrobeCoverage.structuralSubstitutesCount} owned</strong>
            </div>
            {evidence.wardrobeCoverage.matchingItemNames.length > 0 && (
              <div>
                <span className="text-muted block">Matching Pieces in Wardrobe:</span>
                <span className="text-(--ink) font-medium">
                  {evidence.wardrobeCoverage.matchingItemNames.join(', ')}
                </span>
              </div>
            )}
            {evidence.wardrobeCoverage.missingSlotRoles.length > 0 && (
              <div className="pt-2 border-t border-border/60">
                <span className="text-muted block">Missing Complement Roles:</span>
                <span className="text-muted font-medium">
                  {evidence.wardrobeCoverage.missingSlotRoles.join(', ')}
                </span>
                <p className="text-[10px] text-muted italic mt-0.5">
                  Informational only. StyleSaathi does not recommend purchasing missing trend items.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Dimension 4: Personal Style Alignment */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            4. Personal Style Brain Alignment
          </h3>
          <div className="space-y-1.5 text-xs bg-(--ivory)/60 p-3 rounded-xl border border-border">
            <div className="flex justify-between items-center">
              <span>Aesthetic Affinity:</span>
              <strong className="text-(--ink)">
                {(evidence.personalStyleAlignment.alignmentScore * 100).toFixed(0)}%
              </strong>
            </div>
            <div className="flex justify-between items-center">
              <span>Learned Negative Penalty:</span>
              <strong className="text-(--ink)">
                {evidence.personalStyleAlignment.learnedAffinityPenalty ? 'Applied (soft warning)' : 'None'}
              </strong>
            </div>
            <div className="flex justify-between items-center">
              <span>Explicit Avoidance Conflict:</span>
              <strong className="text-(--ink)">
                {evidence.personalStyleAlignment.explicitAvoidanceConflict ? 'Excluded' : 'None'}
              </strong>
            </div>
          </div>
        </section>

        {/* Dimension 5: Weather & Thermal Fit */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            5. Phase 4 Thermal & Context Fit
          </h3>
          <div className="text-xs bg-(--ivory)/60 p-3 rounded-xl border border-border space-y-1">
            <div className="flex justify-between items-center">
              <span>Thermal Suitability:</span>
              <strong className="text-(--ink)">{evidence.contextThermalFit.thermalSuitability}</strong>
            </div>
            <p className="text-muted">{evidence.contextThermalFit.weatherNotes}</p>
          </div>
        </section>

        {/* Dimension 6: Cultural & Modesty Authority */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            6. Phase 6 Cultural & Modesty Context
          </h3>
          <div className="text-xs bg-(--ivory)/60 p-3 rounded-xl border border-border space-y-1">
            <div className="flex justify-between items-center">
              <span>Indian Fusion Context:</span>
              <strong className="text-(--ink)">
                {evidence.culturalModestyContext.isIndianFusion ? 'Yes' : 'No'}
              </strong>
            </div>
            <div className="flex justify-between items-center">
              <span>Modesty Assessment:</span>
              <strong className="text-(--ink)">
                {evidence.culturalModestyContext.modestyAssessment}
              </strong>
            </div>
            <p className="text-muted">{evidence.culturalModestyContext.culturalResonanceNotes}</p>
          </div>
        </section>

        {/* Dimension 7: Dormant Piece Opportunity */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-(--burnished-gold)" />
            7. Phase 8 Dormant Piece Opportunity
          </h3>
          <div className="text-xs bg-(--ivory)/60 p-3 rounded-xl border border-border space-y-1">
            <div className="flex justify-between items-center">
              <span>Dormant Pieces Identified:</span>
              <strong className="text-(--ink)">
                {evidence.rotationOpportunity.hasDormantPieces ? 'Yes' : 'None'}
              </strong>
            </div>
            {evidence.rotationOpportunity.dormantItemNames.length > 0 && (
              <p className="text-(--ink)">
                Revival candidate:{' '}
                <strong>{evidence.rotationOpportunity.dormantItemNames.join(', ')}</strong>
              </p>
            )}
          </div>
        </section>

        {/* Limitations */}
        {evidence.limitations.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Transparent Limitations & Boundaries
            </h3>
            <ul className="list-disc list-inside text-xs text-muted space-y-1 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
              {evidence.limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Non-Authoritative Score Disclaimer */}
        <footer className="pt-2 border-t border-border text-[11px] text-muted">
          <p>
            <strong>Architectural Boundary:</strong> Non-Authoritative Score ({(evidence.nonAuthoritativeDiscoveryScore * 100).toFixed(0)}/100) is UI metadata only. It is never used by Phase 5 to rank outfits, nor by Phase 9 to justify purchases.
          </p>
        </footer>
      </div>
    </div>
  );
};
