'use client';

import { useEffect } from 'react';

import { useAppContext } from '@/context/state';

interface PageChromeProps {
  header?: string | null;
  isAuthenticated?: boolean;
}

export function PageChrome({ header, isAuthenticated }: PageChromeProps) {
  const { changeHeader, setAuthState } = useAppContext();

  useEffect(() => {
    if (header !== undefined) {
      changeHeader(header || 'Birdless Sky');
    }
  }, [changeHeader, header]);

  useEffect(() => {
    if (typeof isAuthenticated === 'boolean') {
      setAuthState(isAuthenticated);
    }
  }, [isAuthenticated, setAuthState]);

  return null;
}
