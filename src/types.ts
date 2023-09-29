/**
 * 
 * File that contains named types, interface, and a main GameEvent class used throughout the codebase.
 * @author Yu Kogure.
 * 
 */

export type {
  Matrix,
  Shape,
  Empty,
  TetrominoColour,
  Floor,
  Piece,
  LazyRNG,
  State,
  Key,
  KeyEvent,
  GameEvent,
  Player,
  DataFromSocket,
  customInterval
};
export { Pos };

import { Tetromino } from "./tetrominos";

/**
 * Matrix: A 2D array, where each cell contains a value of type T.
 */
type Matrix<T> = ReadonlyArray<ReadonlyArray<T>>;

/**
 * Shape: A matrix of numbers, used to represent Tetromino piece.
 */
type Shape = Matrix<Number>;

/**
 * Empty: It's empty! (i.e. 0)
 */
type Empty = 0;

/**
 * customInterval: A custom interval with delay and step properties.
 */
type customInterval = Readonly<{
  delay: number,
  step: number
}>

/**
 * TetrominoColour: All possible colors that a Tetromino or the floor itself could contain.
 */
type TetrominoColour =
  | "cyan"
  | "blue"
  | "orange"
  | "yellow"
  | "green"
  | "purple"
  | "red"
  | "grey"
  | "brown";

/**
 * Floor: A matrix used to represent the floor i.e. the grid, where each cell can either be empty or contain a Tetromino color.
 */
type Floor = Matrix<TetrominoColour | Empty>;

/**
 * Piece: Defines a basic information about a Tetromino piece.
 */
type Piece = Readonly<{
  shape: Shape;
  colour: TetrominoColour;
}>;

/**
 * Player: The player number - you are always 0!
 */
type Player = 0 | 1;

/**
 * LazyRNG: A lazily evaluated random number generator.
 */
type LazyRNG = Readonly<{
  value: number;
  next: () => LazyRNG;
}>;

/**
 * DataFromSocket: Data type that can be received from our websocket connection. 
 * Right now, we only deal with State or boolean (connected or disconnected)
 */
type DataFromSocket = State | boolean;

/**
 * State: Defines the state of the game.
 */
type State = Readonly<{
  gameEnd: boolean;
  score: number;
  highScore: number;
  level: number;
  floor: Floor;
  active: Tetromino;
  next: Tetromino;
  rng: LazyRNG;
  cleared: number;
  highlight: Tetromino;
  lockDelayCount: number;
  hold?: Tetromino;
  swapped: boolean;
  isPaused: boolean;
  gravityOffset: number;
  framesInCurrentRow: number;
  opponentConnected: boolean;
  recentClear: number;
}>;

/**
 * GameEvent: Interface used by all in-game event, that consumes a state and returns a new state
 */
interface GameEvent {
  consume(s: State): State;
}

/**
 * Pos: A 2D position details with x and y coordinates.
 */
class Pos {
  constructor(readonly x: number, readonly y: number) {}

  subtract = (p: Pos) => new Pos(this.x - p.x, this.y - p.y);
  add = (p: Pos) => new Pos(this.x + p.x, this.y + p.y);
}

/**
 * Key: All keyboard keys that we use controls.
 */
type Key =
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown"
  | "Space"
  | "KeyZ"
  | "KeyC"
  | "KeyR"
  | "Escape";

/**
 * KeyEvent: The keyboard events we listen to.
 */
type KeyEvent = "keydown" | "keyup" | "keypress";
