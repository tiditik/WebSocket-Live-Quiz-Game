import { WebSocketServer, WebSocket } from 'ws';

import { RequestType } from './interfaces/request.ts';
import Auth from './auth.ts';
import Game from './game.ts';
import type { Question } from './interfaces/question';

class GameManager {
    private wss: WebSocketServer;
    private auth = new Auth();
    private users = new Map<WebSocket, string>(); // socket -> userId
    private sockets = new Map<string, WebSocket>(); // userId -> socket
    private games = new Map<string, Game>();
    private gamesById = new Map<string, Game>(); // gameId -> Game
    private questionStartedTime = new Map<string, number>(); // gameId -> number 
    private gameAnswerPlayer = new Map<string, string>(); // playerId -> answer
    private gameAnswerPlayerTime = new Map<string, number>(); // playerId -> number

    private nextGameId = 1;


    constructor(port: number) {
        this.wss = new WebSocketServer({ port });
        this.wss.on('connection', (socket) => {
            socket.on('message', (data) => this.socketMessage(socket, data));
            socket.on('close', () => {
                const userId = this.users.get(socket);
                if (userId) {
                    this.sockets.delete(userId);
                    this.users.delete(socket);
                }
            })
        });
        console.log(`WebSocket server started at ws://localhost:${port}`);
    }

    private socketMessage(socket: WebSocket, rawData: any) {
        try {
            const request = JSON.parse(rawData.toString());
            const payload = JSON.parse(request.data);

            switch (request.type) {
                case RequestType.REGISTER_USER: {
                    const result = this.auth.authenticate(payload.name, payload.password);
                    this.send(socket, RequestType.REGISTER_USER, result);

                    if (!result.error) {
                        this.users.set(socket, result.index);
                        this.sockets.set(result.index, socket);
                    }

                    break;
                }
                case RequestType.CREATE_GAME: {
                    const hostId = this.users.get(socket);
                    const questions: Question[] = payload.questions;

                    if (hostId && questions) {
                        const gameId = (this.nextGameId++).toString();
                        const newGame = new Game(gameId, hostId, questions);
                        this.games.set(newGame.code, newGame);
                        this.gamesById.set(newGame.id, newGame);

                        this.send(socket, RequestType.GAME_CREATED, { gameId: newGame.id, code: newGame.code });
                    }

                    break;
                }
                case RequestType.JOIN_GAME: {
                    const playerId = this.users.get(socket);
                    if (playerId && payload.code) {
                        const player = this.auth.getPlayerByIndex(playerId);
                        if (!player) break;

                        const game = this.games.get(payload.code);
                        if (game) {
                            game.addPlayer(player);

                            this.send(socket, RequestType.GAME_JOINED, { gameId: game.id });

                            const sockets = game.players
                                .map(p => this.sockets.get(p.index))
                                .filter((s): s is WebSocket => !!s);

                            this.broadcast(RequestType.PLAYER_JOINED, { playerName: player.name, playerCount: game.players.length }, sockets)
                        }
                    }
                    break;
                }
                case RequestType.START_GAME: {
                    const playerId = this.users.get(socket);
                    const currentGame = this.gamesById.get(payload.gameId);

                    if (!currentGame) { // Если игры не существует
                        return;
                    }

                    if (currentGame.hostId !== playerId) { // Если игрок не хост то скипаем 
                        return;
                    }

                    currentGame.status = 'in_progress';
                    currentGame.currentQuestion = 0;

                    const requestData = {
                        questionNumber: `${currentGame.currentQuestion}`,
                        totalQuestions: `${currentGame.questions.length}`,
                        text: `${currentGame.questions[currentGame.currentQuestion]?.text}`,
                        options: currentGame.questions[currentGame.currentQuestion]?.options,
                        timeLimitSec: `${currentGame.questions[currentGame.currentQuestion]?.timeLimitSec}`,
                    };

                    const sockets = currentGame.players
                        .map(p => this.sockets.get(p.index))
                        .filter((s): s is WebSocket => !!s);

                    this.broadcast(RequestType.QUESTION, requestData, sockets);

                    const startQuestionTime = new Date().getTime();
                    this.questionStartedTime.set(currentGame.id, startQuestionTime);

                    setTimeout(() => {
                        this.processResults(currentGame);
                    }, 1000 * currentGame.questions[currentGame.currentQuestion]?.timeLimitSec!);

                    break;
                }
                case RequestType.ANSWER: {
                    const playerId = this.users.get(socket);
                    const currentGame = this.gamesById.get(payload.gameId);
                    const questionIndex = payload.questionIndex;
                    const answerIndex = payload.answerIndex;
                    const answerTime = new Date().getTime();

                    if (!playerId) {
                        return;
                    }

                    if (!currentGame) {
                        return;
                    }

                    const valueAnswer = answerIndex;
                    this.gameAnswerPlayer.set(playerId, valueAnswer);

                    this.gameAnswerPlayerTime.set(playerId, answerTime);

                    this.send(socket, RequestType.ANSWER_ACCEPTED, { questionIndex });

                    break;
                }
                default:
                    console.error('Неизвестная команда');
            }

        } catch (err) {
            console.error("Parsing error:", err);
        }
    }

    private processResults(game: Game) {
        const questionIndex = game.currentQuestion;
        const correctIndex = game.questions[questionIndex]?.correctIndex;
        const basePoints = 1000;
        let pointsEarned;

        const playerResults = game.players.map((player) => {
            const playerAnswer = this.gameAnswerPlayer.get(player.index.toString());
            const playerAnswered = !!playerAnswer;
            let correctAnswer;
            let pointsEarned;

            if (!playerAnswer) {
                pointsEarned = 0;
                correctAnswer = false;
            } else {
                correctAnswer = Number(playerAnswer) === correctIndex;
                if (correctAnswer) {
                    const questionTimeLimit = game.questions[questionIndex]?.timeLimitSec!;
                    const answerTime = this.gameAnswerPlayerTime.get(player.index)!;
                    const startTime = this.questionStartedTime.get(game.id)!;
                    
                    const timeSpent = (answerTime - startTime) / 1000;
                    let playerTimeRemaining = questionTimeLimit - timeSpent;

                    playerTimeRemaining = Math.max(0, Math.min(playerTimeRemaining, questionTimeLimit));

                    pointsEarned = basePoints * (playerTimeRemaining / questionTimeLimit);
                } else {
                    pointsEarned = 0;
                }
            }

            const resultData = {
                name: player.name,
                answered: playerAnswered,
                correct: correctAnswer,
                pointsEarned: Number(Math.max(0, pointsEarned).toFixed(0)),
                totalScore: Number((player.score + Math.max(0, pointsEarned)).toFixed(0))
            };

            return resultData;
        });

        const sockets = game.players
            .map(p => this.sockets.get(p.index))
            .filter((s): s is WebSocket => !!s);

        this.broadcast(RequestType.QUESTION_RESULT, { questionIndex, correctIndex, playerResults }, sockets);
        console.log('Следующий вопрос либо завершение игры');
    }

    private broadcast(type: string, data: any, target: WebSocket[]) {
        const response = {
            type: type,
            data: JSON.stringify(data),
            id: 0
        };

        target.forEach((client) => client.send(JSON.stringify(response)));
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