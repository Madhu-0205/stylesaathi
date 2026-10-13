import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Local diagnostic logging only. Zero external telemetry or secret logging.
    console.error('AppErrorBoundary caught an unhandled render error:', error?.message);
    if (process.env.NODE_ENV !== 'production') {
      console.error('Component stack trace:', errorInfo?.componentStack);
    }
  }

  private handleReset = () => {
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (e) {
        console.warn('Error during custom boundary reset handler:', e);
      }
    }
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-dvh w-full flex items-center justify-center p-6 bg-background text-(--ink) transition-colors"
        >
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-xl backdrop-blur-md text-center space-y-5 animate-fade-in">
            {/* Editorial Icon Badge */}
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-7 w-7" aria-hidden="true" />
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--kumkum)">
                SYSTEM NOTICE
              </span>
              <h1 className="font-serif text-2xl font-normal text-(--ink) tracking-tight">
                {this.props.fallbackTitle || 'A wardrobe moment caught us'}
              </h1>
              <p className="text-xs text-muted leading-relaxed max-w-xs mx-auto">
                {this.props.fallbackMessage ||
                  'StyleSaathi encountered an unexpected visual rendering hiccup. Your saved wardrobe, plans, and preferences remain safe on your device.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-(--kumkum) px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Try Again</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-border bg-transparent px-5 py-2.5 text-xs font-semibold text-(--ink) hover:bg-muted/10 active:scale-95 transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Restart StyleSaathi</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
