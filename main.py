"""
    The simplest server implementation using websocket and FastAPI that just relays information to the other.
    if I were to try to make this functional, I think it will take too much time. It's server code anyway, which is
    outside the scope of this unit, and does not really matter since it just acts as a middleman.
"""

import json
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

class Game:
    def __init__(self) -> None:
        self.connections: list[WebSocket] = []

    def has_started(self) -> bool:
        return len(self.connections) == 2

    def is_empty(self) -> bool:
        return len(self.connections) == 0

    def remove(self, websocket: WebSocket) -> None:
        self.connections.remove(websocket)

    async def join(self, websocket: WebSocket) -> int:
        if self.has_started():
            return
        self.connections.append(websocket)
        if self.has_started():
            await self.broadcast(True)
        return len(self.connections) - 1

    async def send(self, id: int, message: str) -> None:
        await self.connections[id].send_text(message)

    async def broadcast(self, status: bool) -> None:
        for i in range(len(self.connections)):
            await self.send(i, json.dumps(status))

class Sentinel:

    def __init__(self) -> None:
        self.rooms: list[Game] = []

    def get_room(self) -> Game:
        chosen_room = next((room for room in self.rooms if not room.has_started()), None)
        if chosen_room is None:
            chosen_room = self.create_room()
        return chosen_room

    def create_room(self) -> Game:
        room = Game()
        self.rooms.append(room)
        return room

    def remove_room(self, room: Game) -> Game:
        self.rooms.remove(room)

sentinel = Sentinel()
app = FastAPI()

origins = [
    "http://localhost"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws/tetris")
async def join_room(websocket: WebSocket) -> None:
    await websocket.accept()
    room = sentinel.get_room()
    id = await room.join(websocket)
    # print(room, [len(t.connections) for t in sentinel.rooms])
    await tetris(room, websocket, id)


async def tetris(room: Game, websocket: WebSocket, id: int):
    opponent = 0 if id else 1
    while True:
        message = await websocket.receive()
        message_type = message["type"]
        if message_type == "websocket.disconnect":
            break
        if not room.has_started():
            continue
        content = message.get('text')
        await room.send(opponent, content)

    room.remove(websocket)
    await room.broadcast(False)
    if room.is_empty():
        try:
            sentinel.remove_room(room)
        except RuntimeError:
            pass
    