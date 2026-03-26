import websocket
import json
import random
import string

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

    name = "player_" + random_string()
    password = random_string()

    print(f"[PLAYER] Registering: {name}")

    send(ws, "reg", {
        "name": name,
        "password": password
    })

    response = json.loads(ws.recv())
    data = json.loads(response["data"])
    print("[PLAYER] Register response:", data)

    code = input("Enter game code: ")

    send(ws, "join_game", {"code": code})

    print("[PLAYER] Waiting for events...\n")

    current_game_id = None

    while True:
        response = json.loads(ws.recv())
        data = json.loads(response["data"])
        event_type = response["type"]

        print(f"\n[EVENT] {event_type} -> {data}")

        if event_type == "game_joined":
            current_game_id = data["gameId"]
            print(f"[PLAYER] Joined game: {current_game_id}")

        elif event_type == "question":
            question_index = int(data["questionNumber"])
            text = data["text"]
            options = data["options"]

            print(f"\n=== QUESTION {question_index} ===")
            print(text)

            for i, opt in enumerate(options):
                print(f"{i}: {opt}")

            answer = input("Your answer index: ")

            try:
                answer_index = int(answer)
            except:
                print("Invalid input")
                continue

            send(ws, "answer", {
                "gameId": current_game_id,
                "questionIndex": question_index,
                "answerIndex": answer_index
            })

        elif event_type == "answer_accepted":
            print(f"[PLAYER] Answer accepted for question {data['questionIndex']}")

        elif event_type == "player_joined":
            print(f"[INFO] New player: {data['playerName']} (total: {data['playerCount']})")


if __name__ == "__main__":
    main()