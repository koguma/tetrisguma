/**
 * 
 * File that contains the state management strategies.
 * @author Yu Kogure.
 * 
 */

export {
  initialState,
  reduceState,
  Tick,
  Rotate,
  Move,
  Drop,
  LockDelay,
  Hold,
  Restart,
  Pause,
  Down,
  Connect,
  GarbageOut
};

import { Constants, GRAVITY } from "./const";
import { Tetromino, TetrominoFactory } from "./tetrominos";
import { GameEvent, Floor, Pos, State, TetrominoColour, LazyRNG } from "./types";
import { lazyRNG, pipe, range, withinBound } from "./utils";

/**
 * Create a new floor, and fill in with a supplied value.
 *
 * @param {number} height - The number of rows in the floor.
 * @param {TetrominoColour} colour - Optional. The colour to fill in the floor with.
 * @returns {Floor} The new floor.
 */
const makeFloor = (height: number) => (colour?: TetrominoColour): Floor =>
  range(height).map(() =>
    range(Constants.GRID_WIDTH).map((_) => colour ? colour : 0)
  );

const gameEnd = (f: Floor) => f[0].some(Boolean);
const makeEmptyFloor = makeFloor(Constants.GRID_HEIGHT);

// Common state processors
const updateHighlight = (s: State) => ({...s, highlight: s.active.drop(s.floor)}); // Updating the ghost piece
const rolloverRng = (s: State) => {
  const rng = s.rng.next();
  return {...s, rng, next: getNextTetromino(rng), active: getTetromino(rng.value)}; // Rolling over the RNG and tetrominos
}

const reset = (key: string) => (s: State) => ({...s, [key]: 0}); // Reset the given key to 0
const resetLock = reset("lockDelayCount");
const resetGravity = reset("gravityOffset");

const getTetromino = TetrominoFactory.getTetromino; // just an alias
/**
 * Gets the next tetromino in line
 *
 * @param {rng} LazyRNG - The lazy rng sequence.
 * @returns {Tetromino} The next tetromino.
 */
const getNextTetromino = (rng: LazyRNG): Tetromino => getTetromino(rng.next().value);

// Set up the initial state of the game
const rollingRNG = lazyRNG(Constants.SEED);
const floor = makeEmptyFloor();
const active = getTetromino(rollingRNG.value);
const initialState: State = {
  gameEnd: false,
  score: 0,
  highScore: 0,
  level: 1,
  floor,
  rng: rollingRNG,
  active,
  next: getNextTetromino(rollingRNG),
  cleared: 0,
  lockDelayCount: 0,
  highlight: active.drop(floor),
  swapped: false,
  isPaused: false,
  gravityOffset: 0,
  framesInCurrentRow: 0,
  opponentConnected: false,
  recentClear: 0,
} as const;

class Tick implements GameEvent {

  /**
   * Updates the game state's elapsed time and checks if the active Tetromino should move down by the
   * principle of gravity.
   *
   * @param {State} s - Current game state.
   * @returns {State} The new state after the tick.
   */
  consume = (s: State): State => {
    // increment how long it has already been at the row
    const newState = {
      ...s,
      framesInCurrentRow: 1 + s.framesInCurrentRow,
    };

    // if tetromino should drop now, then drop
    return newState.framesInCurrentRow >=
      GRAVITY[Math.min(s.level - 1 + s.gravityOffset, GRAVITY.length - 1)]
      ? new Move(new Pos(0, 1)).consume({
          ...newState,
          framesInCurrentRow: 0,
        })
      : newState;
  };
}

class Down implements GameEvent {
  constructor(public readonly increasing: boolean) {}

  /**
   * Adjusts the gravity offset based on the `increasing` value.
   *
   * @param {State} s - The current state.
   * @returns {State} The new state after the event.
   */
  consume = (s: State): State =>
    this.increasing
      ? { ...s, gravityOffset: s.gravityOffset + 1 }
      : resetGravity(s);
}

class Move implements GameEvent {
  constructor(public readonly displacement: Pos) {}

  /**
   * Moves the active Tetromino if the move is valid.
   *
   * @param {State} s - The current state.
   * @returns {State} The new state after the event.
   */
  consume = (s: State): State =>
    s.active.moveBy(this.displacement).validPos(s.floor)
      ? updateHighlight({
          ...s,
          active: s.active.moveBy(this.displacement),
        })
      : s;
}

class Rotate implements GameEvent {
  constructor(public readonly direction: number) {}

  /**
   * Rotates the active Tetromino based on the specified direction.
   *
   * @param {State} s - The current state.
   * @returns {State} The new state after the event.
   */
  consume = (s: State): State => {
    const rotated = this.direction > 0
      ? s.active.rotateRight(s.floor)
      : s.active.rotateLeft(s.floor);
    return updateHighlight({
      ...s,
      active: rotated,
    });
  };
}

class LockDelay implements GameEvent {
  /**
   * Delays an instant lock until the right time to allow for leeway.
   *
   * @param {State} s - Current game state.
   * @returns {State} The new state after the lock delay.
   */
  consume = (s: State): State => {
    // increment our current lock delay tracker.
    const canMoveDown = s.active.moveBy(new Pos(0, 1)).validPos(s.floor);
    const newState = canMoveDown
      ? s
      : { ...s, lockDelayCount: s.lockDelayCount + Constants.FRAME_MS };

    // if we are no longer allowed to delay any longer, lock it up.
    return newState.lockDelayCount >= Constants.LOCK_DELAY && !canMoveDown
      ? LockDelay.activate(newState)
      : newState;
  };

  /**
   * Activates the lock delay event, merging the Tetromino into the game floor, 
   * computing state information, and potentially ending the game.
   *
   * @param {State} s - The current state of the game.
   * @returns {State} The updated state after activating the lock delay event.
   */
  static activate = (s: State): State => {
    // Update the floor, dealing with merge and clears.
    const floor = LockDelay.merge(s.active, s.floor);
    const [rowsCleared, newFloor]: Readonly<[number, Floor]> =
      LockDelay.clear(floor);
      
    const score = s.score + 100 * Math.pow(rowsCleared, 2);
    const newLevel =
      1 + Math.floor((s.cleared + rowsCleared) / Constants.LEVEL_CUTOFF);
    
    const newState = pipe({
      ...s,
      floor: newFloor,
      score,
      cleared: s.cleared + rowsCleared,
      level: newLevel,
      swapped: false,
      highScore: Math.max(s.highScore, score),
      recentClear: rowsCleared, // Save the clear.
    }, resetGravity, resetLock, rolloverRng, updateHighlight);

    return gameEnd(floor)
      ? { ...newState, gameEnd: true, next: s.next } // Reset next back to not roll over the preview.
      : newState;
  };

  /**
   * Merges the active Tetromino into the game floor.
   * 
   * @param {Tetromino} active - The active Tetromino to be merged.
   * @param {Floor} f - The current game floor.
   * @returns {Floor} The new game floor after merging the Tetromino.
   */
  static merge = (active: Tetromino, f: Floor): Floor => {
    const isInActive = withinBound(active.shape);
    return f.map((row, rowIndex) => {
      return row.map((cell, colIndex) => {
        const y = rowIndex - active.pos.y;
        const x = colIndex - active.pos.x;
        if (isInActive(x, y) && active.shape[y][x]) { // If shape is filled i.e. coloured
          return active.colour;
        }
        return cell;
      });
    });
  };

  /**
   * Handle clearing up the game floor.
   * 
   * @param {Floor} f - The current game floor.
   * @returns {Readonly<[number, Floor]>} A tuple where of the number of rows cleared 
   * and the new game floor.
   */
  static clear = (f: Floor): Readonly<[number, Floor]> => {
    const remaining = f.filter((row) => !row.every(Boolean));
    const cleared = f.length - remaining.length;
    const fresh: Floor = makeFloor(cleared)();
    return [cleared, [...fresh, ...remaining]]; // Combine the empty and remaining rows.
  };
}

class Hold implements GameEvent {
  /**
   * Processes the hold event, and swaps the Tetrominos or moves the active Tetromino to the hold area.
   *
   * @param {State} s - The current state.
   * @returns {State} The new state after the hold event.
   */
  consume = (s: State): State => {
    // only 1 swap is allowed before the next drop
    if (s.swapped) {
      return s;
    }

    const swappedState = {
      ...s,
      hold: getTetromino(s.rng.value),
      swapped: true,
    };

    // If there's a Tetromino in the hold, swap with active.
    if (s.hold) {

      return pipe({
        ...swappedState,
        active: s.hold,
      }, resetGravity, resetLock, updateHighlight);
    }

    return pipe(
      swappedState,
      resetGravity,
      resetLock,
      rolloverRng,
      updateHighlight
    );

  };
}

class Pause implements GameEvent {
  constructor(public readonly pause: boolean) {}

  /**
   * Processes the pause event and updates the game's paused status.
   *
   * @param {State} s - The current state.
   * @returns {State} The new state after pausing/resuming.
   */
  consume = (s: State): State => ({ ...s, isPaused: this.pause });
}

class Connect implements GameEvent {
  constructor(public readonly connected: boolean) {}
  
  /**
   * Processes the connection event and updates the opponent's connection status.
   *
   * @param {State} s - The current state.
   * @returns {State} The new state after processing the connection event.
   */
  consume = (s: State): State => ({ ...s, opponentConnected: this.connected });
}

class Drop implements GameEvent {

  /**
   * Processes the hard drop event and updates the Tetromino's position on the game floor.
   *
   * @param {State} s - The current state.
   * @returns {State} The new state after dropping the Tetromino.
   */
  consume = (s: State): State =>
    LockDelay.activate({ ...s, active: s.active.drop(s.floor) }); // instantly drop & activate the LockDelay
}

class GarbageOut implements GameEvent {
  constructor(public readonly columns: number) {}

  /**
   * Processes the garbage out event, by adding garbage rows to the game floor.
   *
   * @param {State} s - The current state.
   * @returns {State} The new state after the event.
   */
  consume = (s: State): State => {

    const numRowsToDelete =
      this.columns == 1
        ? 0
        : this.columns == 2
        ? 1
        : this.columns == 3
        ? 2
        : this.columns;

    // Generate garbage rows with a single continuous random hole, and create a new floor.
    const removed: Floor = [...s.floor.slice(0, numRowsToDelete)];
    const holeIndex = s.rng.value % Constants.GRID_WIDTH;
    const garbage: Floor = makeFloor(numRowsToDelete)("brown").map((row) => {
      return [...row.slice(0, holeIndex), 0, ...row.slice(holeIndex + 1)];
    });
    const floor: Floor = [...s.floor.slice(numRowsToDelete), ...garbage];
    const active = getTetromino(s.rng.value);
    const newState = pipe({
      ...s,
      floor,
      active,
    }, resetGravity, resetLock, updateHighlight);
    
    // Immediate end if gameEnd given the floor or if any row in the removed section had blocks.
    return gameEnd(floor) || removed.flat().some(Boolean)
      ? { ...newState, gameEnd: true }
      : newState;
  };
}

class Restart implements GameEvent {
  
  /**
   * Processes the restart event and returns a fresh state.
   *
   * @param {State} s - The current state.
   * @returns {State} The new state after restart.
   */
  consume = (s: State): State => {
    const floor = makeEmptyFloor();

    return pipe({
      ...s,
      gameEnd: false,
      score: 0,
      level: 1,
      floor,
      cleared: 0,
      swapped: false,
      isPaused: false,
      framesInCurrentRow: 0,
      recentClear: 0,
      hold: undefined
    }, resetGravity, resetLock, rolloverRng, updateHighlight)
  };
}


/**
 * Applies the game event onto s i.e. our reducer.
 * 
 * @param {State} s - The state of the game.
 * @param {GameEvent} e - The event that has occurred within the game.
 * @returns {State} The updated state of the game after processing the event.
 */
const reduceState = (s: State, e: GameEvent): State => {
  // Only process the Restart, Pause, or Connect: if ended or paused.
  if (s.gameEnd || s.isPaused) {
    return e instanceof Restart || e instanceof Pause || e instanceof Connect
      ? e.consume(s)
      : s;
  }
  return e.consume(s);
};
