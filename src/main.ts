/**
 * 
 * File that contains the main function that is ran on page load, as well as all of the observable logics.
 * These are then fed in to our statemanagement system to be rendered.
 * @author Yu Kogure.
 * 
 */

import "./style/style.css";
import { Pos, State, KeyEvent, Key, GameEvent, DataFromSocket, customInterval } from "./types";
import { Constants, OPPONENT, SELF } from "./const";
import {
  Connect,
  Down,
  Drop,
  GarbageOut,
  Hold,
  LockDelay,
  Move,
  Pause,
  Restart,
  Rotate,
  Tick,
  initialState,
  reduceState,
} from "./state";
import { render } from "./view";
import {
  fromEvent,
  merge,
  of,
  Observable,
  timer,
  Subscription,
  NEVER,
  EMPTY,
  concat,
  partition,
} from "rxjs";
import {
  map,
  filter,
  scan,
  switchMap,
  takeUntil,
  bufferTime,
  expand,
  pairwise,
} from "rxjs/operators";
import { webSocket } from "rxjs/webSocket";

/**
 * Main function that is called on page load
 */
export function main() {

  const socket$ = webSocket<string>(Constants.WS_ENDPOINT); // create a new websocket connection

  /**
   * Creates an observable that emits keyboard events for a chose key and event type.
   * 
   * @param {KeyEvent} e - The type of key event.
   * @param {Key} k - The specific key to observe.
   * 
   * @returns {Observable<KeyboardEvent>} An observable that emits the specific keyboard events for the provided key.
   */
  const keyObservable$ = (e: KeyEvent, k: Key) =>
    fromEvent<KeyboardEvent>(document, e).pipe(
      filter(({ code }) => code === k),
      filter(({ repeat }) => !repeat)
    );

  // Keyboard inputs
  const startLeft$ = keyObservable$("keydown", "ArrowLeft");
  const startRight$ = keyObservable$("keydown", "ArrowRight");
  const stopLeft$ = keyObservable$("keyup", "ArrowLeft");
  const stopRight$ = keyObservable$("keyup", "ArrowRight");
  const startDown$ = keyObservable$("keydown", "ArrowDown");
  const stopDown$ = keyObservable$("keyup", "ArrowDown");
  const escape$ = keyObservable$("keydown", "Escape");
  const rotateLeft$ = keyObservable$("keydown", "KeyZ").pipe(map(() => new Rotate(-1)));
  const rotateRight$ = keyObservable$("keydown", "ArrowUp").pipe(map(() => new Rotate(1)));
  const space$ = keyObservable$("keypress", "Space").pipe(map(() => new Drop))
  const hold$ = keyObservable$("keypress", "KeyC").pipe(map(() => new Hold));
  const restart$ = keyObservable$("keypress", "KeyR").pipe(map(() => new Restart));

  /**
   * Creates an observable that emits events at an accelerating rate over time, 
   * starting when the `start$` observable emits, and stops when either the `stop$`, 
   * `stopOther$`, or the predefined `escape$` observable emits.
   * 
   * @param {Observable<U>} start$ - The observable to start the emission.
   * @param {Observable<V>} stop$ - The observable to stop the emission.
   * @param {Observable<W>} stopOther$ - Another observable to stop the emission.
   * @param {() => T} moveAction - A function that returns the value to emit during acceleration.
   * @param {() => T} finalAction - Optional. A function to be executed for cleanup or any final tasks.
   * 
   * @returns {Observable<T>} An observable that emits values at an accelerating rate.
   */
  const continuousObservable = <T, U, V, W>(
    start$: Observable<U>,
    stop$: Observable<V>,
    stopOther$: Observable<W>,
    moveAction: () => T,
    finalAction?: () => T
  ) =>
    start$.pipe(
      switchMap(() =>
        concat(
          // This block emits an initial delay, then creates a loop that recursively gets called.
          // It also gets shorter each time, Which helps simulate the acceleration effect.
          of({ delay: Constants.INIT_DELAY, step: 1 }).pipe(
            // Track delay time and step for quadratic decrement
            expand(({ delay, step }: customInterval) => {
              const decrement = step * step * 1.3;
              const nextDelay = delay - decrement;

              // Simulate an accelerating timer
              return timer(nextDelay).pipe(
                map(() => ({
                  delay: nextDelay,
                  step: Math.min(step + 1, 5),
                }))
              );
            }),

            // Stops on its own stop$, the opposite direction's start$, or escape i.e. pause.
            // I just pass in escape since this will always be the case for whatever future observables I might make
            takeUntil(merge(stop$, stopOther$, escape$)),
            map(() => moveAction())
          ),
          // If there's a final action to do i.e. cleanups, emit its value
          finalAction ? of(finalAction()) : EMPTY
        )
      )
    );

  // Set up our accelerating movements

  const moveLeft$ = continuousObservable(
    startLeft$,
    stopLeft$,
    startRight$,
    () => new Move(new Pos(-1, 0))
  );

  const moveRight$ = continuousObservable(
    startRight$,
    stopRight$,
    startLeft$,
    () => new Move(new Pos(1, 0))
  );

  const moveDown$ = continuousObservable(
    startDown$,
    stopDown$,
    NEVER,
    () => new Down(true),
    () => new Down(false)
  );

  // Restart should reset pause, while Pause should reverse its current.
  const paused$ = merge(escape$, restart$).pipe(
    scan(
      (paused, event) => (event instanceof Restart ? false : !paused),
      false
    ),
    map((paused) => new Pause(paused)),
  );



  // Parse Data from the socket, if it is boolean, then it is about connection.
  // Otherwise, it contains the information about the opponent state.
  const [opponentState$, connection$] : Readonly<[Observable<State>, Observable<boolean>]>= partition(
    socket$.pipe(map((s): DataFromSocket => JSON.parse(s))),
    (data: DataFromSocket): data is State => typeof data !== "boolean"
  );

  // Connection update needs to change OUR state.
  const connectionUpdate$: Observable<Readonly<[Connect]>> = connection$.pipe(
    map((update) => [new Connect(update)])
  );

  // If opponent state has changed its recentClear value, it means that we need have a new garbage.
  const generateGarbage$ = opponentState$.pipe(
    pairwise(),
    filter(([previousState, currentState]) => previousState.recentClear !== currentState.recentClear),
    map(([_, currentState]) => new GarbageOut(currentState.recentClear))
  )

  // Merges most, if not, all of the gameeEvents
  const gameEvent$: Observable<ReadonlyArray<GameEvent>> = merge(
    moveLeft$,
    moveRight$,
    moveDown$,
    rotateLeft$,
    rotateRight$,
    space$,
    hold$,
    restart$,
    paused$,
    generateGarbage$
  ).pipe(
    // Buffer to simulate the 60 FPS in most modern Tetris
    bufferTime(Constants.FRAME_MS),
    map((events: ReadonlyArray<GameEvent>) => {
      // We process pauses first, ticks next, others, lock delay, followed by garbage and restart
      // Order is actually quite important for game logic and also user experience
      const restarts = events.filter((e) => e instanceof Restart);
      const pauses = events.filter((e) => e instanceof Pause);
      const garbages = events.filter((e) => e instanceof GarbageOut);
      const others = events.filter(
        (e) => !(e instanceof Pause || e instanceof Restart || e instanceof GarbageOut)
      );
      return [...pauses, new Tick(), ...others, new LockDelay(), ...garbages, ...restarts];
    })
  );

  // Set up the renderer
  const opponentRenderer = render(OPPONENT);
  const selfRenderer = render(SELF);

  // Merge connection updates and game events, and accumulate their changes to our state
  const state$: Observable<State> = merge(gameEvent$, connectionUpdate$).pipe(
    scan(
      (s: State, events: ReadonlyArray<GameEvent>): State =>
        events.reduce(reduceState, s),
      initialState
    )
  );

  // Any updats to opponent state gets sent to the renderer for opponent
  const opSubscription$: Subscription = opponentState$.subscribe({
    next: opponentRenderer,
  });

  // Any updates to our state gets sent to the renderer for us
  const mySubscription$: Subscription = state$.subscribe(selfRenderer);

  // Any updates to our state are also broadcasted to our websocket connection
  const sendData$: Subscription = state$.subscribe((state) => {
    socket$.next(JSON.stringify(state));
  });
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
