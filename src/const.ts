/**
 * 
 * File that contains most, if not all of the constants used throughout the game.
 * @author Yu Kogure.
 * 
 */

export { Viewport, Constants, Block, GRAVITY, SELF, OPPONENT };

const Viewport = {
  CANVAS_WIDTH: 200,
  CANVAS_HEIGHT: 400,
  PREVIEW_WIDTH: 160,
  PREVIEW_HEIGHT: 80,
} as const;

const Constants = {
  FRAME_MS: 1000 / 60,
  LOCK_DELAY: 500, // Delay before locking an active piece in ms
  GRID_WIDTH: 10,
  GRID_HEIGHT: 20,
  SEED: 20,
  LEVEL_CUTOFF: 2, // Number of lines needed to clear to level up
  INIT_DELAY: 100, // Initial Delay for Keyboard Inputs
  WS_ENDPOINT: "ws://localhost:8000/ws/tetris",
} as const;

const Block = {
  WIDTH: Viewport.CANVAS_WIDTH / Constants.GRID_WIDTH,
  HEIGHT: Viewport.CANVAS_HEIGHT / Constants.GRID_HEIGHT,
} as const;

// Represent player details
const SELF = 0;
const OPPONENT = 1;

// Querying gives us the Frames needed for a tetromino to move to the next row
const GRAVITY: ReadonlyArray<number> = [
  48, 43, 38, 33, 28, 23, 18, 13, 8, 6, // Levels 00 to 09
  5, 5, 5,                              // Levels 10 to 12
  4, 4, 4,                              // Levels 13 to 15
  3, 3, 3,                              // Levels 16 to 18
  2, 2, 2, 2, 2, 2, 2, 2, 2, 2,         // Levels 19 to 28
  // For level 29 and above it's 1
  1
];
