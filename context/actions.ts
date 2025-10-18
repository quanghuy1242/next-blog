/**
 * @typedef {(value: string) => void} ChangeFuncType
 *
 * @typedef {Object} ChangeStatesType
 * @property {ChangeFuncType} changeHeader - Change header of the Application
 */

import type { Dispatch } from 'react';
import type { Action } from './state';

export const changeHeader = 'changeHeader' as const;

export interface ChangeStates {
  changeHeader: (value: string) => void;
}

export function getChangeStateFuncs(dispatch: Dispatch<Action>): ChangeStates {
  return {
    changeHeader: (value: string) => dispatch({ type: changeHeader, value }),
  };
}
