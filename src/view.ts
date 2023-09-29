/**
 * 
 * File that contains the ways to update our HTML view. All impurities with side effects are contained in here,
 * albeit minimised.
 * @author Yu Kogure.
 * 
 */

export { render };
import { Tetromino, TetrominoFactory } from "./tetrominos";
import { Player, Pos, Shape, State, TetrominoColour } from "./types";
import { Block, SELF, Viewport } from "./const";
import { bestPosition } from "./utils";


/**
 * Draws a Tetromino shape on a SVG canvas.
 * 
 * @param {SVGElement} canvas - The SVG canvas where the Tetromino will be drawn.
 * @param {Tetromino} tetromino - the Tetromino.
 * @param {TetrominoColour} [override] - Optional. An override colour to use instead of the supposed original colour.
 */
const drawTetromino = (
  canvas: SVGElement,
  { shape, colour, pos }: Tetromino,
  override?: TetrominoColour
) => {
  // Loop through each cell in the Tetromino's shape.
  shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      // If the cell is truthy, (meaning it is part of the Tetromino), draw the block on the canvas.
      if (cell)
        drawBlock(
          canvas,
          new Pos(x,y).add(pos),
          override ? override : colour
        );
    });
  });
};

/**
 * Draws a single block on a SVG canvas.
 * 
 * @param {SVGElement} canvas - The SVG canvas where the block will be drawn.
 * @param {Pos} displacement - The position (x,y) of the block on the canvas.
 * @param {TetrominoColour} color - The colour of the block.
 */
const drawBlock = (
  canvas: SVGElement,
  displacement: Pos,
  color: TetrominoColour
) => {
  // Don't draw blocks that would be positioned above the canvas (active tetromino start above the floor (grid).
  if (displacement.y < 0) return;

  const cell = createSvgElement(canvas.namespaceURI, "rect", {
    height: `${Block.HEIGHT}`,
    width: `${Block.WIDTH}`,
    x: `${Block.WIDTH * displacement.x}`,
    y: `${Block.HEIGHT * displacement.y}`,
    style: `fill: ${color}; border: none;`,
    class: "removable", // Assigns the 'removable' class for easier deletion as a batch.
  });

  canvas.appendChild(cell);
};

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
  namespace: string | null,
  name: string,
  props: Record<string, string> = {}
) => {
  const elem = document.createElementNS(namespace, name) as SVGElement;
  Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
  return elem;
};

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param {HTMLElement} canvas - The canvas to display the SVG element.
 * @param {SVGGraphicsElement} elem - The SVG Element to display.
 */
const show = (canvas: HTMLElement) => (elem: SVGGraphicsElement) => {
  elem.setAttribute("visibility", "visible");
  canvas.appendChild(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGGraphicsElement) =>
  elem.setAttribute("visibility", "hidden");

/**
 * Renders the game's current state. i.e. updates the view
 * 
 * @param {Player} player - Determines which player's canvas to update (SELF or OPPONENT).
 * @param {state} s - The current state of the game to update the view with
 */
const render = (player: Player) => {
  // suffix to identify which view to update
  const suffix = player === SELF ? "" : "2";
  const opponentSuffix = player === SELF ? "2" : "";

  // Canvas elements
  const svg = document.querySelector(
    `#svgCanvas${suffix}`
  ) as SVGGraphicsElement & HTMLElement;
  const otherSvg = document.querySelector(
    `#svgCanvas${opponentSuffix}`
  ) as SVGGraphicsElement & HTMLElement;
  const preview = document.querySelector(
    `#svgPreview${suffix}`
  ) as SVGGraphicsElement & HTMLElement;
  const holding = document.querySelector(
    `#svgHolding${suffix}`
  ) as SVGGraphicsElement & HTMLElement;
  const gameover = document.querySelector(
    `#gameOver${suffix}`
  ) as SVGGraphicsElement & HTMLElement;
  const disconnected = document.querySelector(
    "#disconnected2"
  ) as SVGGraphicsElement & HTMLElement;
  const paused = document.querySelector(
    `#paused${suffix}`
  ) as SVGGraphicsElement & HTMLElement;
  const container = document.querySelector(`#main${suffix}`) as HTMLElement;
  const levelText = document.querySelector(
    `#levelText${suffix}`
  ) as HTMLElement;
  const scoreText = document.querySelector(
    `#scoreText${suffix}`
  ) as HTMLElement;
  const highScoreText = document.querySelector(
    `#highScoreText${suffix}`
  ) as HTMLElement;

  // Show differs for SELF and OPPONENT rendering
  const showForSelf = show(svg);
  const showForOther = show(otherSvg);

  svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
  svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);
  preview.setAttribute("height", `${Viewport.PREVIEW_HEIGHT}`);
  preview.setAttribute("width", `${Viewport.PREVIEW_WIDTH}`);
  holding.setAttribute("height", `${Viewport.PREVIEW_HEIGHT}`);
  holding.setAttribute("width", `${Viewport.PREVIEW_WIDTH}`);

  /**
   * Computes the best (centered) x-position for a Tetromino in the preview area.
   * @param {Shape} shape - The shape of the tetromino
   */
  const centerXPosition = bestPosition(Viewport.PREVIEW_WIDTH / Block.WIDTH)(
    "x"
  );

  /**
   * Computes the best (centered) y-position for a Tetromino in the preview area.
   * @param {Shape} shape - The shape of the tetromino
   */
  const centerYPosition = bestPosition(Viewport.PREVIEW_HEIGHT / Block.HEIGHT)(
    "y"
  );

  /**
   * Recreated from a shape, a Tetromino positioned optimally for display in the preview / hold box area.
   *
   * @param {Shape} shape - The shape of the Tetromino.
   * @returns {Tetromino} The Tetromino adjusted st its optimal center.
   */
  const showSmallTetromino = (shape: Shape) =>
    TetrominoFactory.getOriginalTetromino(shape).moveBy(
      new Pos(centerXPosition(shape), centerYPosition(shape))
    );

  return (s: State) => {
    // Remove all removable elements in our container
    Array.from(container.querySelectorAll(".removable")).forEach((element) => {
      element.parentNode!.removeChild(element);
    });

    // Only if I am rendering MY state, show disconnected on the other player's svg canvas
    if (player == SELF) {
      if (!s.opponentConnected) {
        showForOther(disconnected);
      } else {
        hide(disconnected);
      }
    }

    levelText.textContent = String(s.level);
    scoreText.textContent = String(s.score);
    highScoreText.textContent = String(s.highScore);

    // Draw next tetromino
    drawTetromino(preview, showSmallTetromino(s.next.shape));

    // Draw holding tetromino
    if (s.hold) {
      drawTetromino(holding, showSmallTetromino(s.hold.shape));
    }

    // Draw floor i.e. grid
    s.floor.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) drawBlock(svg, new Pos(x,y), cell);
      });
    });

    // Draw highlight if not game over yet, otherwise we need to show gameover for ourself
    if (!s.gameEnd) {
      drawTetromino(svg, s.highlight, "grey");
      hide(gameover);
    } else {
      showForSelf(gameover);
    }

    drawTetromino(svg, s.active);

    // If it's paused, show paused on our canvas
    if (s.isPaused) {
      showForSelf(paused);
    } else {
      hide(paused);
    }
  };
};
