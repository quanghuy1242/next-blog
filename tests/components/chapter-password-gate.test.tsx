import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ChapterPasswordGate } from 'components/pages/books/chapter-password-gate';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ChapterPasswordGate', () => {
  test('submits the password and refreshes the page after unlocking', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          chapterId: '7',
          expiresAt: '2026-04-27T14:16:30.043Z',
          proof: 'proof-123',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 200,
        }
      )
    );
    const onUnlocked = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('fetch', fetchMock);

    render(<ChapterPasswordGate chapterId={7} onUnlocked={onUnlocked} />);

    fireEvent.change(screen.getByLabelText('Password'), {
      target: {
        value: 'open-sesame',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock and read' }));

    await waitFor(() => {
      expect(onUnlocked).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chapters/unlock',
      expect.objectContaining({
        body: JSON.stringify({
          chapterId: 7,
          password: 'open-sesame',
        }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        method: 'POST',
      })
    );
  });
});
