import { WebSocketServer, WebSocket } from 'ws';

import { RequestType } from './interfaces/request.ts';
import Auth from './auth.ts';
import Game from './game.ts';
import type { Question } from './interfaces/question';

class GameManager {
    private wss: WebSocketServer;
    private auth = new Auth();
    private users = new Map<WebSocket, string>(); // socket -> userId
    private games = new Map<string, Game>();
    private nextGameId = 1;


    constructor(port: number) {
        this.wss = new WebSocketServer({ port });
        this.wss.on('connection', (socket) => {
            socket.on('message', (data) => this.socketMessage(socket, data));
        });
        console.log(`WebSocket server started at ws://localhost:${port}`);
    }

    private socketMessage(socket: WebSocket, rawData: any) {
        try {
            const request = JSON.parse(rawData.toString());
            const payload = JSON.parse(request.data);

            switch(request.type) {
                case RequestType.REGISTER_USER:
                    const result = this.auth.authenticate(payload.name, payload.password);
                    this.send(socket, RequestType.REGISTER_USER, result);
                    
                    if (!result.error) {
                        this.users.set(socket, result.index);
                    }
                    
                    break;
                case RequestType.CREATE_GAME:
                    const hostId = this.users.get(socket);
                    const questions: Question[] = payload.questions;

                    if (hostId && questions) {
                        const gameId = (this.nextGameId++).toString();
                        const newGame = new Game(gameId, hostId, questions);
                        this.games.set(newGame.code, newGame);

                        this.send(socket, RequestType.GAME_CREATED, { gameId: newGame.id, code: newGame.code });
                    }

                    break;
                case RequestType.JOIN_GAME:
                    const playerId = this.users.get(socket);
                    if (playerId && payload.code) {
                        const player = this.auth.getPlayerByIndex(playerId);
                        if (!player) break;

                        const game = this.games.get(payload.code);
                        if (game) {
                            game.addPlayer(player);
                            this.send(socket, RequestType.GAME_JOINED, { gameId: game.id });
                        }
                        console.log(game?.players);
                    }
                    break;
                    
                default:
                    console.error('Неизвестная команда');
            }

        } catch (err) {
            console.error("Parsing error:", err);
        }
    }

    private send(socket: WebSocket, type: string, data: any) {
        const response = {
            type: type,
            data: JSON.stringify(data),
            id: 0
        };
        socket.send(JSON.stringify(response));
    }
}


const server = new GameManager(65311);