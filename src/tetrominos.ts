/**
 * 
 * File that contains the information on how tetromino is created, stored, and represented.
 * The idea behind: https://tetris.wiki/Super_Rotation_System#How_Guideline_SRS_Really_Works
 * @author Yu Kogure.
 * 
 */

export { Tetromino, TetrominoFactory };

import { Constants } from "./const";
import { Shape, TetrominoColour, Pos, Piece, Floor, Matrix } from "./types";
import {
  rotateMatrixLeft,
  rotateMatrixRight,
  simillarMatrix,
  firstFilledRow,
  firstFilledCol,
  lastFilledCol,
  lastFilledRow,
  withinBound,
  bestPosition,
} from "./utils";

/** Tetromino Shape Matrix */

const IBlock: Shape = [
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
];

const JBlock: Shape = [
  [1, 0, 0],
  [1, 1, 1],
  [0, 0, 0],
];

const LBlock: Shape = [
  [0, 0, 1],
  [1, 1, 1],
  [0, 0, 0],
];

const OBlock: Shape = [
  [0, 1, 1],
  [0, 1, 1],
  [0, 0, 0],
];

const SBlock: Shape = [
  [0, 1, 1],
  [1, 1, 0],
  [0, 0, 0],
];

const TBlock: Shape = [
  [0, 1, 0],
  [1, 1, 1],
  [0, 0, 0],
];

const ZBlock: Shape = [
  [1, 1, 0],
  [0, 1, 1],
  [0, 0, 0],
];

/**
 * Represents the wall kick functionality.
 */
abstract class WallKick {
  
  /* The offset details for each pieces */

  public static JLSTZ_OFFSETS : Matrix<Pos> = [
    [new Pos(0, 0), new Pos(0, 0), new Pos(0, 0), new Pos(0, 0), new Pos(0, 0)],
    [new Pos(0, 0), new Pos(1, 0), new Pos(1, 1), new Pos(0, -2), new Pos(1, -2)],
    [new Pos(0, 0), new Pos(0, 0), new Pos(0, 0), new Pos(0, 0), new Pos(0, 0)],
    [new Pos(0, 0), new Pos(-1, 0), new Pos(-1, 1), new Pos(0, -2), new Pos(-1, -2)]
  ];

  public static I_OFFSETS : Matrix<Pos> = [
    [new Pos(0, 0), new Pos(-1, 0), new Pos(2, 0), new Pos(-1, 0), new Pos(2, 0)],
    [new Pos(-1, 0), new Pos(0, 0), new Pos(0, 0), new Pos(0, -1), new Pos(0, 2)],
    [new Pos(-1, -1), new Pos(1, -1), new Pos(-2, -1), new Pos(1, 0), new Pos(-2, 0)],
    [new Pos(0, -1), new Pos(0, -1), new Pos(0, -1), new Pos(0, 1), new Pos(0, -2)]
  ];
  
  public static O_OFFSETS : Matrix<Pos> = [
    [new Pos(0, 0)],
    [new Pos(0, 1)],
    [new Pos(-1, 1)],
    [new Pos(-1, 0)]
  ];

  /**
   * Calculates the necessary wall kick offset positions to check for when a Tetromino is rotated.
   * 
   * @param {Tetromino} from - The original state of the Tetromino.
   * @param {Tetromino} to - The state of the Tetromino after rotation.
   * @returns {ReadonlyArray<Pos>} An array of positions contining the offset information required 
   *                              to check for when rotating the tetromino.
   */
  public static getData(from: Tetromino, to: Tetromino): ReadonlyArray<Pos> {
    const shapeIs = simillarMatrix(from.shape); // Allow any orientation.
    const offsets = shapeIs(IBlock) ? WallKick.I_OFFSETS : shapeIs(OBlock) ? WallKick.O_OFFSETS : WallKick.JLSTZ_OFFSETS; 
    const current = offsets[from.rotationState];
    const next = offsets[to.rotationState];

    // Uses the True Rotation System to find offset differences.
    return current.map(
      (pos, i) => pos.subtract(next[i])
    );
  }
}

/**
 * Represents a Tetromino.
 */
class Tetromino {
  constructor(
    public readonly shape: Shape,
    public readonly colour: TetrominoColour,
    public readonly pos: Pos, // relative position
    public readonly rotationState: number // [0..3], where 0 is the originial, 1 is 90 degrees clockwise....
  ) {}

  /**
   * Rotates the Tetromino 90° counterclockwise and checks if the rotation is valid.
   * 
   * @param {Floor} f - The floor to check against.
   * @returns {Tetromino} New rotated Tetromino if valid, otherwise returns the Tetromino in its original state.
   */
  rotateLeft = (f: Floor) => {
    const nextState = (this.rotationState - 1) % 4;
    const rotated = new Tetromino(
      rotateMatrixLeft(this.shape),
      this.colour,
      this.pos,
      nextState >= 0 ? nextState : 4 + nextState // state -1 === state 3
    );
    return this.__rotate(rotated, f);
  };

  /**
   * Rotates the Tetromino 90° clockwise and checks if the rotation is valid.
   * 
   * @param {Floor} f - The floor to check against.
   * @returns {Tetromino} New rotated Tetromino if valid, otherwise returns the Tetromino in its original state.
   */
  rotateRight = (f: Floor) => {
    const rotated = new Tetromino(
      rotateMatrixRight(this.shape),
      this.colour,
      this.pos,
      (this.rotationState + 1) % 4
    );
    return this.__rotate(rotated, f);
  };

  /**
   * Helper: Rotates the Tetromino with respect to the wall kick data.
   *
   * @param {Tetromino} to - The tetromino after rotation.
   * @param {Floor} f - The floor to check against.
   * @returns {Tetromino} New rotated Tetromino if valid, otherwise returns the Tetromino in its original state.
   */
  __rotate = (to: Tetromino, f: Floor) => {
    // Test on all wallkick data.
    const wallKickData = WallKick.getData(this, to);
    const possibleTetrominos = wallKickData
      .map((pos: Pos) => to.moveBy(pos))
      .filter((tetromino) => tetromino.validPos(f));

    return possibleTetrominos.length === 0 ? this : possibleTetrominos[0];
  };

  moveBy = (d: Pos) =>
    new Tetromino(
      this.shape,
      this.colour,
      this.pos.add(d),
      this.rotationState
    );

  moveTo = (newPos: Pos) =>
    new Tetromino(
      this.shape,
      this.colour,
      newPos, // We never mutate pos so this is ok,
      this.rotationState
    );

  /**
   * Checks whether the tetromino's current position is valid.
   *
   * @param {Floor} f - The floor to check against.
   * @returns {boolean} True if the tetromino's position is valid, false otherwise.
   */
  validPos = (f: Floor): boolean => {
    const { x, y } = this.pos;

    // Since a matrix might be surrounded by 0s, we should allow movements
    // so long as the part that is not 0 i.e. EMPTY bleaches the boundary.
    const withinSpecialBound =
      x + firstFilledCol(this.shape) >= 0 &&
      x + lastFilledCol(this.shape) + 1 <= f[0].length &&
      y + firstFilledRow(this.shape) >= -2 && // Shapes spawn 2 blocks above the grid originally.
      y + lastFilledRow(this.shape) + 1 <= f.length;

    return withinSpecialBound && !this.overlaps(f);
  };

  /**
   * Checks if the tetromino overlaps with any existing blocks on the game floor.
   *
   * @param {Floor} f - The floor to check against.
   * @returns {boolean} True if the tetromino overlaps, false otherwise.
   */
  overlaps = (f: Floor): boolean => {
    const isInFloor = withinBound(f);
    return this.shape.some((row, y) =>
      row.some((cell, x) => {
        const relY = this.pos.y + y;
        const relX = this.pos.x + x;
        // if the relative position is valid, and 2 such positions are truthy.
        return isInFloor(relX, relY) ? f[relY][relX] && cell : false;
      })
    );
  };

  /**
   * Simulate a hard drop i.e. try to move the tetromino downwards until it can't.
   *
   * @param {Floor} f - The floor to check against.
   * @returns {Tetromino} New tetromino after it has been "dropped" to its furthest valid position.
   */
  drop = (f: Floor): Tetromino =>
    !this.moveBy(new Pos(0, 1)).validPos(f)
      ? this
      : this.moveBy(new Pos(0, 1)).drop(f);
}


/**
 * Computes the best (centered) x-position for a Tetromino when spawning.
 * @param {Shape} shape - The shape of the tetromino
 */
const centerXPosition = bestPosition(Constants.GRID_WIDTH)("x");

/**
 * A factory for creating new tetrominos.
 */
abstract class TetrominoFactory {
  
  private static TETROMINOES: ReadonlyArray<Piece> = [
    { shape: IBlock, colour: "cyan" },
    { shape: JBlock, colour: "blue" },
    { shape: LBlock, colour: "orange" },
    { shape: OBlock, colour: "yellow" },
    { shape: SBlock, colour: "green" },
    { shape: TBlock, colour: "purple" },
    { shape: ZBlock, colour: "red" },
  ];

  /**
   * Generate a Tetromino based on a given hash value.
   * 
   * @param {number} hash - A hash value.
   * @returns {Tetromino} A new Tetromino object based on the hash value.
   */
  public static getTetromino(hash: number): Tetromino {
    const index = hash % TetrominoFactory.TETROMINOES.length;
    const { shape, colour } = TetrominoFactory.TETROMINOES[index];
    return new Tetromino(
      shape,
      colour,
      new Pos(Math.floor(centerXPosition(shape)), -1 * firstFilledRow(shape) - 2),
      0
    );
  }

  /**
   * Retrieve an original Tetromino (with default position and rotation) based on its shape matrix.
   * 
   * @param {Shape} originalShape - The shape of the desired Tetromino, in any orientation.
   * @returns {Tetromino} A new Tetromino object matching the provided shape in its default state.
   */
  public static getOriginalTetromino(originalShape: Shape): Tetromino {
    // Identify which standard tetromino matches the provided shape
    const shapeIs = simillarMatrix(originalShape);
    const { shape, colour } = TetrominoFactory.TETROMINOES.find(({ shape }) =>
      shapeIs(shape)
    )!;

    return new Tetromino(shape, colour, new Pos(0, 0), 0);
  }
}
