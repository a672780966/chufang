/**
 * PresentationStateMachine
 * Coordinates UI states, input locks, and animation sequence lifecycles.
 */

export type PresentationState =
  | 'IDLE'
  | 'DRAGGING'
  | 'SNAPPING'
  | 'FINAL_CEREMONY'
  | 'DISH_REVEAL'
  | 'SERVING'
  | 'RECEIPT_RESOLVE'
  | 'BOARD_REFLOW'
  | 'DAY_CLEAR';

export type StateChangeListener = (newState: PresentationState, oldState: PresentationState) => void;

export class PresentationStateMachine {
  private _state: PresentationState = 'IDLE';
  private _listeners: StateChangeListener[] = [];
  private _inputLockReasons: Set<string> = new Set();

  getState(): PresentationState {
    return this._state;
  }

  transitionTo(newState: PresentationState): void {
    if (this._state === newState) return;
    const oldState = this._state;
    this._state = newState;
    for (const listener of this._listeners) {
      listener(newState, oldState);
    }
  }

  onStateChange(listener: StateChangeListener): () => void {
    this._listeners.push(listener);
    return () => {
      const idx = this._listeners.indexOf(listener);
      if (idx >= 0) this._listeners.splice(idx, 1);
    };
  }

  acquireInputLock(reason: string): void {
    this._inputLockReasons.add(reason);
  }

  releaseInputLock(reason: string): void {
    this._inputLockReasons.delete(reason);
  }

  isInputLocked(): boolean {
    if (this._inputLockReasons.size > 0) return true;
    return (
      this._state === 'FINAL_CEREMONY' ||
      this._state === 'DISH_REVEAL' ||
      this._state === 'SERVING' ||
      this._state === 'DAY_CLEAR'
    );
  }

  reset(): void {
    this._state = 'IDLE';
    this._inputLockReasons.clear();
  }
}
