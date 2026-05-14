import type { Dispatch } from 'react';
import type { Action, HomePostsState } from './state';

export const setHomePosts = 'setHomePosts' as const;

export interface ChangeStates {
  setHomePosts: (value: HomePostsState | null) => void;
}

export function getChangeStateFuncs(dispatch: Dispatch<Action>): ChangeStates {
  return {
    setHomePosts: (value: HomePostsState | null) =>
      dispatch({ type: setHomePosts, value }),
  };
}
