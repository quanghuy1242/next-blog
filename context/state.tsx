import type { ReactNode } from 'react';
import { createContext, useContext, useReducer } from 'react';
import { changeHeader, getChangeStateFuncs, type ChangeStates } from './actions';

export interface State {
  header: string;
}

export type Action = { type: typeof changeHeader; value: string };

const AppContext = createContext<(State & ChangeStates) | undefined>(undefined);

function init(): State {
  return {
    header: 'Birdless Sky',
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case changeHeader: {
      return { ...state, header: action.value };
    }
    default:
      throw new Error(`Unknown action type: ${action.type as string}`);
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
