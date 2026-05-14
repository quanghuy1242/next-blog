'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useMemo, useReducer } from 'react';
import type { Post } from '@/types/cms';
import {
  changeHeader,
  getChangeStateFuncs,
  setAuthState,
  setHomePosts,
  type ChangeStates,
} from './actions';

export interface State {
  header: string;
  authState: boolean | null;
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
  | { type: typeof changeHeader; value: string }
  | { type: typeof setHomePosts; value: HomePostsState | null }
  | { type: typeof setAuthState; value: boolean | null };

const AppContext = createContext<(State & ChangeStates) | undefined>(undefined);

function init(): State {
  return {
    header: 'Birdless Sky',
    authState: null,
    homePosts: null,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case changeHeader: {
      return state.header === action.value
        ? state
        : { ...state, header: action.value };
    }
    case setHomePosts: {
      return { ...state, homePosts: action.value };
    }
    case setAuthState: {
      return state.authState === action.value
        ? state
        : { ...state, authState: action.value };
    }
    default: {
      // const _exhaustiveCheck: never = action;
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
