import type { ReactNode } from 'react';
import { createContext, useContext, useReducer } from 'react';
import type { Post } from 'types/datocms';
import { changeHeader, getChangeStateFuncs, setHomePosts, type ChangeStates } from './actions';

export interface State {
  header: string;
  homePosts: HomePostsState | null;
}

export interface HomePostsState {
  posts: Post[];
  offset: number;
  hasMore: boolean;
}

export type Action =
  | { type: typeof changeHeader; value: string }
  | { type: typeof setHomePosts; value: HomePostsState | null };

const AppContext = createContext<(State & ChangeStates) | undefined>(undefined);

function init(): State {
  return {
    header: 'Birdless Sky',
    homePosts: null,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case changeHeader: {
      return { ...state, header: action.value };
    }
    case setHomePosts: {
      return { ...state, homePosts: action.value };
    }
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error('Unknown action type');
    }
  }
}

interface AppWrapperProps {
  children: ReactNode;
}

export function AppWrapper({ children }: AppWrapperProps) {
  const [state, dispatch] = useReducer(reducer, init());

  return (
    <AppContext.Provider value={{ ...state, ...getChangeStateFuncs(dispatch) }}>
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
