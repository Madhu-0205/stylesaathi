import React, { useState } from 'react';
import { Mail, Sparkles, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { StyleSaathiLogo } from '../brand/StyleSaathiLogo';
import { useAuth } from '../../context/AuthContext';

interface AuthViewProps {
  onSuccess?: () => void;
  onContinueAsGuest?: () => void;
  isModal?: boolean;
  onClose?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  onSuccess,
  onContinueAsGuest,
  isModal = false,
  onClose,
}) => {
  const { signInWithGoogle, signInWithEmail, continueAsGuest } = useAuth();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await signInWithGoogle();
      onSuccess?.();
    } catch (e: any) {
      setError(e.message || 'Google authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      await signInWithEmail(email, name);
      onSuccess?.();
    } catch (e: any) {
      setError(e.message || 'Email authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuest = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await continueAsGuest();
      if (onContinueAsGuest) {
        onContinueAsGuest();
      } else {
        onSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <div className="w-full max-w-md mx-auto flex flex-col items-center text-center p-6 sm:p-8 animate-fade-in">
      {/* Brand Identity */}
      <div className="mb-4">
        <StyleSaathiLogo variant="mark" size="md" />
      </div>

      <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-(--kumkum)">
        STYLESAATHI PROFILE
      </span>

      <h1 className="mt-2 font-serif text-2xl sm:text-3xl font-normal text-(--ink) tracking-tight leading-tight">
        YOUR WARDROBE.<br />YOUR STYLE.<br />YOUR SAATHI.
      </h1>

      <p className="mt-2 text-xs sm:text-sm text-(--muted) leading-relaxed max-w-sm">
        Create your StyleSaathi profile to unlock your personalized wardrobe.
      </p>

      {/* Value highlights */}
      <div className="mt-5 w-full rounded-2xl border border-(--border) bg-(--ivory)/70 p-4 text-left shadow-2xs">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-(--burnished-gold) block mb-2.5">
          WITH YOUR PROFILE:
        </span>
        <ul className="space-y-2 text-xs text-(--text)">
          <li className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-(--kumkum) shrink-0" />
            <span>Personalized styling &amp; aesthetic memory</span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-(--burnished-gold) shrink-0" />
            <span>Style Calendar for upcoming looks &amp; plans</span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-(--kumkum) shrink-0" />
            <span>Wear history &amp; rotation intelligence</span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-(--burnished-gold) shrink-0" />
            <span>Local-first archive with safe cross-device sync</span>
          </li>
        </ul>
      </div>

      {error && (
        <div className="mt-3 w-full rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-2.5 text-xs text-red-700 dark:text-red-300 text-center">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 w-full space-y-2.5">
        {!showEmailForm ? (
          <>
            {/* Continue with Google */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full flex min-h-12 items-center justify-center gap-3 rounded-xl border border-(--border) bg-(--card) px-4 py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider text-(--ink) transition-all hover:bg-(--ivory) hover:border-(--ink) active:scale-[0.98] shadow-2xs disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Continue with Email */}
            <button
              type="button"
              onClick={() => setShowEmailForm(true)}
              disabled={isSubmitting}
              className="w-full flex min-h-12 items-center justify-center gap-2.5 rounded-xl border border-(--ink) bg-(--ink) px-4 py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider text-(--paper) transition-all hover:opacity-95 active:scale-[0.98] shadow-2xs disabled:opacity-50"
            >
              <Mail className="h-4 w-4 text-(--burnished-gold)" />
              <span>Continue with Email</span>
            </button>

            {/* Continue without an account */}
            <button
              type="button"
              onClick={handleGuest}
              disabled={isSubmitting}
              className="w-full pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-(--muted) hover:text-(--ink) transition-colors"
            >
              Continue without an account
            </button>
          </>
        ) : (
          <form onSubmit={handleEmailSubmit} className="space-y-3 text-left">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-(--muted) mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ananya"
                className="w-full rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-sm text-(--ink) focus:border-(--ink) focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-(--muted) mb-1">
                Email Address <span className="text-(--kumkum)">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-sm text-(--ink) focus:border-(--ink) focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex min-h-11 items-center justify-center gap-2 rounded-xl border border-(--ink) bg-(--ink) px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-(--paper) transition-all hover:opacity-95 active:scale-[0.98] shadow-2xs disabled:opacity-50"
            >
              <span>Create Profile</span>
              <ArrowRight className="h-3.5 w-3.5 text-(--burnished-gold)" />
            </button>

            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              className="w-full text-center text-[11px] font-semibold tracking-wider text-(--muted) hover:text-(--ink) pt-1"
            >
              Back to other sign-in options
            </button>
          </form>
        )}
      </div>

      <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-(--muted)">
        <ShieldCheck className="h-3.5 w-3.5 text-(--burnished-gold)" />
        <span>Local-first &amp; privacy-honoring. No spam.</span>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--background)/80 backdrop-blur-md p-4 animate-fade-in">
        <div className="relative w-full max-w-md rounded-2xl border border-(--border) bg-(--card) shadow-xl">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-(--muted) hover:text-(--ink) hover:bg-(--ivory)"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-(--background) p-4">
      {content}
    </div>
  );
};
