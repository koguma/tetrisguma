# Tetris

## Usage

Setup for the frontend (requires node.js):
```
> npm install
```

Start tests:
```
> npm test
```

Serve up the App (and ctrl-click the URL that appears in the console)
```
> npm run dev
```

Setup for the backend (requires Python & FastAPI):
```
> pip install fastapi "uvicorn[standard]"
```

Serve up the Backend Server:
```
> uvicorn main:app --reload

NOTE:
If the backend is not ran, websoket connection will hog up, and the game might not work
Websocket endpoint will probably go up sometime later this week on http://tetris.koguma.net/ws/
But please run on local server!!
For the best experience i.e. actually having games run simultaneously, you might have to
open a new window, side by side, as browsers prevent background javascripts.

```

```

## Game Controls

Pause / Resume - Escape
Restart - R
Move Left - Left Arrow
Move Right - Right Arrow
Soft Drop - Down Arrow
Hard Drop - Space
Rotate Left - Z
Rotate Right - Up Arrow
Hold - C

## File Structures

```
src/
  main.ts        -- main code logic inc. core game loop and observables
  types.ts       -- common types and type aliases
  utils.ts       -- util functions
  state.ts       -- state processing and transformation
  view.ts        -- rendering
  tetrominos.ts  -- tetrominos
  const.ts       -- common constants
```
