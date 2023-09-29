/**
 *
 * File that contains the utility functions that are used throughout the codebase.
 * @author Yu Kogure.
 *
 */

export {
  rotateMatrixLeft,
  rotateMatrixRight,
  pureReverse,
  chain,
  transposeMatrix,
  firstFilledCol,
  firstFilledRow,
  lastFilledCol,
  lastFilledRow,
  lazyRNG,
  simillarMatrix,
  range,
  withinBound,
  bestPosition,
  pipe
};

import { Matrix, LazyRNG, Shape } from "./types";

/** Misc Helper Utilities */

/**
 * Generates an array of numbers in the range [0,n).
 *
 * @param {number} n - (exclusive) The upper bound for the range.
 * @returns {ReadonlyArray<number>} An array of numbers in the range [0,n).
 */
const range = (n: number): ReadonlyArray<number> =>
  [...Array(n)].map((_, i) => i);

/**
 * Returns the centered position for a tetromino shape, taking into account its emptiness,
 * based on the given step and direction.
 *
 * @param {number} step - The step i.e. size of the row/column.
 * @param {"x" | "y"} direction - The direction to check for the position.
 * @param {Shape} shape - The shape to find the centered position for.
 * @returns {number} - The suggested centered position offset.
 */
const bestPosition =
  (step: number) =>
  (direction: "x" | "y") =>
  (shape: Shape): number => {
    const lastFilled =
      direction === "x" ? lastFilledCol(shape) : lastFilledRow(shape);
    const firstFilled =
      direction === "x" ? firstFilledCol(shape) : firstFilledRow(shape);
    return (step - (lastFilled - firstFilled + 1)) / 2 - firstFilled;
  };

/** Matrix Helper Utilities */

/**
 * Returns whether the given coordinates are within the bounds of a matrix.
 *
 * @param {Matrix<T>} matrix - A 2D array representing the matrix.
 * @param {number} x - The x coordinate to check for.
 * @param {number} y - The y coordinate to check for.
 * @returns {boolean} - Whether the given coordinates are within the bounds of a matrix.
 */
const withinBound =
  <T>(matrix: Matrix<T>) =>
  (x: number, y: number) =>
    x >= 0 && y >= 0 && x < matrix[0].length && y < matrix.length;

/**
 * Chains a function call `n` times.
 *
 * @param {(_: T) => T} f - The function to chain.
 * @param {T} e - The initial value to start the chain.
 * @param {number} n - Number of times to chain the function call.
 * @returns {T} - The result after chaining the function `n` times.
 */
const chain =
  <T>(f: (_: T) => T) =>
  (e: T) =>
  (n: number) =>
    range(n).reduce((a) => f(a), e);

/**
 * 
 * It pipes... first argument is the value, others are functions working on that value
 * 
 */
type AnyFunc = (...arg: any) => any;
type PipeArgs<F extends AnyFunc[], Acc extends AnyFunc[] = []> = F extends [
  (...args: infer A) => infer B
]
  ? [...Acc, (...args: A) => B]
  : F extends [(...args: infer A) => any, ...infer Tail]
  ? Tail extends [(arg: infer B) => any, ...any[]]
    ? PipeArgs<Tail, [...Acc, (...args: A) => B]>
    : Acc
  : Acc;
type LastFnReturnType<F extends Array<AnyFunc>, Else = never> = F extends [
  ...any[],
  (...arg: any) => infer R
]
  ? R
  : Else;
const pipe = <FirstFn extends AnyFunc, F extends AnyFunc[]>(
  arg: Parameters<FirstFn>[0],
  firstFn: FirstFn,
  ...fns: PipeArgs<F> extends F ? F : PipeArgs<F>
): LastFnReturnType<F, ReturnType<FirstFn>> => {
  return (fns as AnyFunc[]).reduce((acc, fn) => fn(acc), firstFn(arg));
};

/**
 * Pure way to reverse an array.
 *
 * @param {ReadonlyArray<T>} arr - The array to reverse.
 * @returns {ReadonlyArray<T>} - A new reversed array.
 */
const pureReverse = <T>(arr: ReadonlyArray<T>): ReadonlyArray<T> =>
  arr.reduce<ReadonlyArray<T>>((a, e) => [e, ...a], []);

/**
 * Rotates the given matrix 90 degrees to the right.
 *
 * @param {Matrix<T>} matrix - The matrix to rotate.
 * @returns {Matrix<T>} - A new rotated matrix.
 */
const rotateMatrixRight = <T>(matrix: Matrix<T>): Matrix<T> => {
  const reversedRows: Matrix<T> = pureReverse(matrix);
  return matrix[0].map((_, i) => reversedRows.map((row) => row[i]));
};

/**
 * Checks if two matrices are similar in any 4 orientations.
 *
 * @param {Matrix<T>} matrix1 - The first matrix to compare.
 * @param {Matrix<T>} matrix2 - The second matrix to compare.
 * @returns {boolean} - True if the matrices are similar after rotation, false otherwise.
 */
const simillarMatrix =
  <T>(matrix1: Matrix<T>) =>
  (matrix2: Matrix<T>): boolean =>
    range(4)
      .map(chain(rotateMatrixRight)(matrix1))
      .some((m) => m.toString() === matrix2.toString());

/**
 * Rotates the given matrix 90 degrees to the left i.e. 270 degrees to the right..
 *
 * @param {Matrix<T>} matrix - The matrix to rotate.
 * @returns {Matrix<T>} - A new rotated matrix.
 */
const rotateMatrixLeft = <T>(matrix: Matrix<T>): Matrix<T> =>
  chain(rotateMatrixRight)(matrix)(3);

/**
 * Transposes the given matrix.
 *
 * @param {Matrix<T>} matrix - The matrix to transpose.
 * @returns {Matrix<T>} - A new transposed matrix.
 */
const transposeMatrix = <T>(matrix: Matrix<T>): Matrix<T> =>
  matrix[0].map((_, i) => matrix.map((row) => row[i]));

/**
 * Finds the first row in the matrix that has at least one filled cell.
 *
 * @param {Matrix<T>} matrix - The matrix to search.
 * @returns {number} - The index of the first filled row, (-1 if no row is filled).
 */
const firstFilledRow = <T>(matrix: Matrix<T>): number =>
  matrix.findIndex((row) => row.filter(Boolean).length);

/**
 * Finds the last row in the matrix that has at least one filled cell.
 *
 * @param {Matrix<T>} matrix - The matrix to search.
 * @returns {number} - The index of the last filled row, (-1 if no row is filled).
 */
const lastFilledRow = <T>(matrix: Matrix<T>): number =>
  matrix.length - 1 - firstFilledRow(pureReverse(matrix));

/**
 * Finds the first column in the matrix that has at least one filled cell.
 *
 * @param {Matrix<T>} matrix - The matrix to search.
 * @returns {number} - The index of the first filled column.
 */
const firstFilledCol = <T>(matrix: Matrix<T>): number =>
  firstFilledRow(transposeMatrix(matrix));

/**
 * Finds the last column in the matrix that has at least one filled cell.
 *
 * @param {Matrix<T>} matrix - The matrix to search.
 * @returns {number} - The index of the last filled column.
 */
const lastFilledCol = <T>(matrix: Matrix<T>): number =>
  matrix[0].length - 1 - firstFilledRow(pureReverse(transposeMatrix(matrix)));

/** RNG Helper Utilities */

/**
 * Pure RNG Class: (source: Tutorial)
 */
abstract class RNG {
  // LCG using GCC's constants
  private static m = 0x80000000;
  private static a = 1103515245;
  private static c = 12345;

  /**
   * Call `hash` repeatedly to generate the sequence of hashes.
   * @param {number} seed
   * @returns a hash of the seed
   */
  public static hash = (seed: number) => (RNG.a * seed + RNG.c) % RNG.m;
}

/**
 * infinite sequence of RNG values using lazy evaluations.
 *
 * @param {number} [seed=0] - Initial seed for the random number generator.
 * @returns {LazyRNG} - A lazy RNG object containing the current value and a method to get the next RNG.
 */
const lazyRNG = (seed: number = 0) => {
  return (function _next(seed: number): LazyRNG {
    return {
      value: RNG.hash(seed),
      next: () => _next(RNG.hash(seed)), // leads us to the next LazyRNG object
    };
  })(seed);
};
