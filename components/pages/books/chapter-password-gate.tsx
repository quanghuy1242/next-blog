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
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-blue">
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
    <section className="mx-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center">
          <PasswordIcon />
        </div>

        <h2 className="mt-3 text-center text-2xl font-semibold tracking-tight text-slate-900">
          Chapter locked
        </h2>

        <p className="mt-2 max-w-md text-center text-sm leading-6 text-slate-600">
          This chapter is protected by a password. Enter it to continue reading.
        </p>

        <form className="mt-5 w-full max-w-md space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label
              htmlFor={`chapter-password-${chapterId}`}
              className="text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-blue/70">
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
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
                  'h-11 w-full rounded-xl border bg-white pl-9 pr-10 text-sm text-slate-900 outline-none transition',
                  'placeholder:text-slate-400 focus:border-blue focus:ring-0',
                  error ? 'border-red-300' : 'border-slate-200'
                )}
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-2 flex items-center rounded-full px-2 text-slate-400 transition hover:text-slate-700"
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
              'inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold text-white transition-colors',
              canSubmit ? 'bg-blue hover:bg-darkBlue' : 'cursor-not-allowed bg-blue/60'
            )}
          >
            {isSubmitting ? 'Unlocking...' : 'Unlock and read'}
          </button>
        </form>

        <p className="mt-5 max-w-md border-t border-slate-100 pt-4 text-center text-sm leading-6 text-slate-500">
          If you do not have the password, contact the author or site owner for access.
        </p>
      </div>
    </section>
  );
}
