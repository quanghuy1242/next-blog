import React, { useState } from 'react';
import cn from 'classnames';

interface ChapterPasswordGateProps {
  chapterId: number | string;
  onUnlocked?: () => Promise<unknown> | unknown;
}

type UnlockChapterPasswordResponse = {
  chapterId: string;
  expiresAt: string;
  proof: string;
};

function PasswordIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-10 w-10 text-blue-600"
    >
      <rect
        x="5.25"
        y="10.25"
        width="13.5"
        height="9.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8.5 10.25V8.5a3.5 3.5 0 0 1 7 0v1.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 13.5v2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeIcon({ isOpen }: { isOpen: boolean }) {
  return isOpen ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M4 5l16 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9.3 9.6a3 3 0 0 1 4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M10.5 4.9A10.8 10.8 0 0 1 12 4.5c6 0 9.5 6 9.5 6a16.7 16.7 0 0 1-4.1 4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.2 7.8C3.3 10.2 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChapterPasswordGate({
  chapterId,
  onUnlocked,
}: ChapterPasswordGateProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = password.length > 0 && !isSubmitting;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/chapters/unlock', {
        body: JSON.stringify({
          chapterId,
          password,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      const responseBody = (await response.json().catch(() => null)) as
        | UnlockChapterPasswordResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        const errorMessage =
          responseBody && typeof responseBody === 'object' && 'error' in responseBody
            ? responseBody.error
            : null;

        setError(errorMessage ?? 'Unable to unlock this chapter.');
        return;
      }

      if (
        !responseBody ||
        typeof responseBody !== 'object' ||
        !('proof' in responseBody) ||
        !('chapterId' in responseBody)
      ) {
        setError('Unable to unlock this chapter.');
        return;
      }

      setPassword('');

      if (onUnlocked) {
        await Promise.resolve(onUnlocked());
      }
    } catch {
      setError('Unable to unlock this chapter.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_55%)]"
      />
      <div className="relative flex flex-col items-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 ring-8 ring-blue-50/70">
          <PasswordIcon />
        </div>

        <h2 className="text-center text-3xl font-semibold tracking-tight text-slate-900">
          Chapter locked
        </h2>

        <p className="mt-3 max-w-lg text-center text-sm leading-6 text-slate-600 sm:text-base">
          This chapter is protected by a password. Enter it to continue reading.
        </p>

        <form className="mt-8 w-full max-w-lg space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor={`chapter-password-${chapterId}`} className="text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <rect
                    x="4.25"
                    y="8.25"
                    width="11.5"
                    height="7.5"
                    rx="1.75"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M6.5 8.25V6.75a3.5 3.5 0 0 1 7 0v1.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <input
                id={`chapter-password-${chapterId}`}
                autoComplete="current-password"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) {
                    setError(null);
                  }
                }}
                placeholder="Enter password"
                className={cn(
                  'h-14 w-full rounded-2xl border bg-white pl-11 pr-12 text-slate-900 outline-none transition',
                  'placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100',
                  error ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-200'
                )}
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-3 flex items-center rounded-full px-2 text-slate-400 transition hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={isSubmitting}
              >
                <EyeIcon isOpen={showPassword} />
              </button>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              'inline-flex h-14 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition',
              canSubmit
                ? 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99]'
                : 'cursor-not-allowed bg-blue-300'
            )}
          >
            {isSubmitting ? 'Unlocking...' : 'Unlock and read'}
          </button>
        </form>

        <p className="mt-8 max-w-lg border-t border-slate-100 pt-6 text-center text-sm leading-6 text-slate-500">
          If you do not have the password, contact the author or site owner for access.
        </p>
      </div>
    </section>
  );
}
