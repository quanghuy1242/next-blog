'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useMemo, useReducer } from 'react';
import type { Post } from '@/types/cms';
import {
  getChangeStateFuncs,
  setHomePosts,
  type ChangeStates,
} from './actions';

export interface State {
  homePosts: HomePostsState | null;
}

export interface HomePostsState {
  posts: Post[];
  offset: number;
  hasMore: boolean;
  category: string | null;
  tags: string[];
}

export type Action =
  | { type: typeof setHomePosts; value: HomePostsState | null };

const AppContext = createContext<(State & ChangeStates) | undefined>(undefined);

function init(): State {
  return {
    homePosts: null,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case setHomePosts: {
      return { ...state, homePosts: action.value };
    }
    default: {
      throw new Error('Unknown action type');
    }
  }
}

interface AppWrapperProps {
  children: ReactNode;
}

export function AppWrapper({ children }: AppWrapperProps) {
  const [state, dispatch] = useReducer(reducer, init());
  const actions = useMemo(() => getChangeStateFuncs(dispatch), [dispatch]);
  const value = useMemo(
    () => ({ ...state, ...actions }),
    [actions, state]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): State & ChangeStates {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppContext must be used within an AppWrapper');
  }

  return context;
}
