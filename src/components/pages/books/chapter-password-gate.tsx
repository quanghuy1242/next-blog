import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Button } from '@/components/ui/aria/button';
import { TextField } from '@/components/ui/aria/text-field';
import { CenteredPanel } from '@/components/ui/surface/card';

interface ChapterPasswordGateProps {
  chapterId: number | string;
  onUnlocked?: () => Promise<unknown> | unknown;
}

type UnlockChapterPasswordResponse = {
  chapterId: string;
  expiresAt: string;
  proof: string;
};

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
    <CenteredPanel>
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center">
          <Lock aria-hidden className="h-8 w-8 text-primary" />
        </div>

        <h2 className="mt-3 text-center text-2xl font-semibold tracking-tight text-slate-900">
          Chapter locked
        </h2>

        <p className="mt-2 max-w-md text-center text-sm leading-6 text-slate-600">
          This chapter is protected by a password. Enter it to continue reading.
        </p>

        <form className="mt-5 w-full max-w-md space-y-4" onSubmit={handleSubmit}>
          <TextField
            label="Password"
            name="chapter-password"
            autoComplete="current-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(nextPassword) => {
              setPassword(nextPassword);
              if (error) {
                setError(null);
              }
            }}
            placeholder="Enter password"
            isInvalid={Boolean(error)}
            errorMessage={error ?? undefined}
            inputClassName="h-11 rounded-xl text-slate-900 placeholder:text-slate-400"
            startAdornment={<Lock aria-hidden className="h-3.5 w-3.5" />}
            endAdornment={
              <Button
                type="button"
                onPress={() => setShowPassword((current) => !current)}
                variant="ghost"
                size="icon"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                isDisabled={isSubmitting}
                className="text-slate-400 hover:text-slate-700"
              >
                {showPassword ? (
                  <EyeOff aria-hidden className="h-4 w-4" />
                ) : (
                  <Eye aria-hidden className="h-4 w-4" />
                )}
              </Button>
            }
          />

          <Button
            type="submit"
            isDisabled={!canSubmit}
            isPending={isSubmitting}
            size="lg"
            fullWidth
          >
            Unlock and read
          </Button>
        </form>

        <p className="mt-5 max-w-md border-t border-slate-100 pt-4 text-center text-sm leading-6 text-slate-500">
          If you do not have the password, contact the author or site owner for access.
        </p>
      </div>
    </CenteredPanel>
  );
}
