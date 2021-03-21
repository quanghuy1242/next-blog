/**
 * @typedef {{type: string, value: string}} ActionType
 * @typedef {{header: string}} StateType
 */

import { createContext, useContext, useReducer } from 'react';
import { changeHeader, getChangeStateFuncs } from './actions';

const AppContext = createContext();

/**
 * Get initial value of application state
 * @returns {StateType}
 */
function init() {
  return {
    // Header of the whole application
    header: "Birdless Sky"
  }
}

/**
 * The main reducer function
 * @param {StateType} state - The whole state of application
 * @param {ActionType} action - the action object
 * @returns {StateType} New state
 */
function reducer(state, action) {
  switch (action.type) {
    case changeHeader: {
      return {...state, header: action.value}
    }
    default:
      throw Error("What is this?");
  }
}

/**
 * @param {any} children
 * @returns {JSX.Element} - AppContext Wrapper
 */
export function AppWrapper({ children }) {
  let [state, dispatch] = useReducer(reducer, init())

  return (
    <AppContext.Provider value={{ ...state, ...getChangeStateFuncs(dispatch) }}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * Get the value from application state
 * @returns {StateType & import('./actions').ChangeStatesType}
 */
export function useAppContext() {
  return useContext(AppContext);
}
