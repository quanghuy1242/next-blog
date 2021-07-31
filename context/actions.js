/**
 * @typedef {(value: string) => void} ChangeFuncType
 *
 * @typedef {Object} ChangeStatesType
 * @property {ChangeFuncType} changeHeader - Change header of the Application
 */

//#region Action types
export const changeHeader = 'changeHeader';
//#endregion

/**
 * @param {import('react').Dispatch<import('./state').ActionType>} dispatch - dispatch function from useReducer
 * @returns {ChangeStatesType} The object that contain all change state functions
 */
export function getChangeStateFuncs(dispatch) {
  return {
    changeHeader: (value) => dispatch({ type: changeHeader, value: value }),
  };
}
