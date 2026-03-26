import websocket
import json
import random
import string
import time

URL = "ws://localhost:65311"


def random_string(length=8):
    return ''.join(random.choice(string.ascii_lowercase) for _ in range(length))


def send(ws, type_, data):
    payload = {
        "id": 0,
        "type": type_,
        "data": json.dumps(data)
    }
    ws.send(json.dumps(payload))


def main():
    ws = websocket.create_connection(URL)

    name = "host_" + random_string()
    password = random_string()

    print(f"[HOST] Registering: {name}")

    send(ws, "reg", {
        "name": name,
        "password": password
    })

    response = json.loads(ws.recv())
    data = json.loads(response["data"])
    print("[HOST] Register response:", data)

    questions = [
        {
            "text": "Столица Франции?",
            "options": ["Лондон", "Берлин", "Париж", "Мадрид"],
            "correctIndex": 2,
            "timeLimitSec": 30
        },
        {
            "text": "2 + 2 = ?",
            "options": ["3", "4", "5", "6"],
            "correctIndex": 1,
            "timeLimitSec": 20
        }
    ]

    print("[HOST] Creating game...")
    send(ws, "create_game", {"questions": questions})

    response = json.loads(ws.recv())
    data = json.loads(response["data"])

    game_id = data["gameId"]
    code = data["code"]

    print(f"\n=== GAME CREATED ===")
    print(f"Game ID: {game_id}")
    print(f"JOIN CODE: {code}")
    print("====================\n")

    input("Press ENTER to start game...")

    send(ws, "start_game", {"gameId": game_id})

    print("[HOST] Game started. Listening events...\n")

    while True:
        response = json.loads(ws.recv())
        data = json.loads(response["data"])

        print(f"[HOST RECEIVED] {response['type']} -> {data}")


if __name__ == "__main__":
    main()