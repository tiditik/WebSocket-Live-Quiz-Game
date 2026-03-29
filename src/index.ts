import { WebSocketServer, WebSocket } from 'ws';
import { RequestType } from './interfaces/request.ts';
import Auth from './auth.ts';
import Game from './game.ts';

interface Request {
  type: RequestType;
  data: any;
}

class GameManager {
  private wss: WebSocketServer;
  private auth = new Auth();

  private users = new Map<WebSocket, string>();
  private sockets = new Map<string, WebSocket>();
  private gamesById = new Map<string, Game>();

  private answers = new Map<string, number>();
  private answerTime = new Map<string, number>();

  private questionStart = new Map<string, number>();
  private timers = new Map<string, NodeJS.Timeout>();

  private nextGameId = 1;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (socket) => {
      socket.on('message', (data) => this.handleMessage(socket, data));
      socket.on('close', () => this.handleDisconnect(socket));
    });
  }

  private handleDisconnect(socket: WebSocket) {
    const userId = this.users.get(socket);
    if (!userId) return;

    this.users.delete(socket);
    this.sockets.delete(userId);
  }

  private handleMessage(socket: WebSocket, raw: any) {
    let req: Request;

    try {
      const parsed = JSON.parse(raw.toString());
      req = { type: parsed.type, data: parsed.data };
    } catch {
      return;
    }

    switch (req.type) {
      case RequestType.REGISTER_USER:
        this.register(socket, req.data);
        break;

      case RequestType.CREATE_GAME:
        this.createGame(socket, req.data);
        break;

      case RequestType.JOIN_GAME:
        this.joinGame(socket, req.data);
        break;

      case RequestType.START_GAME:
        this.startGame(socket, req.data);
        break;

      case RequestType.ANSWER:
        this.answer(socket, req.data);
        break;
    }
  }

  private register(socket: WebSocket, data: any) {
    const result = this.auth.authenticate(data.name, data.password);

    this.send(socket, RequestType.REGISTER_USER, result);

    if (!result.error) {
      this.users.set(socket, result.index);
      this.sockets.set(result.index, socket);
    }
  }

  private createGame(socket: WebSocket, data: any) {
    const hostId = this.users.get(socket);
    if (!hostId) return;

    const id = String(this.nextGameId++);
    const game = new Game(id, hostId, data.questions);

    this.gamesById.set(id, game);

    this.send(socket, RequestType.GAME_CREATED, {
      gameId: game.id,
      code: game.code
    });

    this.sendPlayersUpdate(game);
  }

  private joinGame(socket: WebSocket, data: any) {
    const playerId = this.users.get(socket);
    if (!playerId) return;

    const game = [...this.gamesById.values()].find(g => g.code === data.code);
    if (!game) return;

    const player = this.auth.getPlayerByIndex(playerId);
    if (!player) return;

    game.addPlayer(player);

    this.send(socket, RequestType.GAME_JOINED, { gameId: game.id });

    this.broadcast(game, RequestType.PLAYER_JOINED, {
      playerName: player.name,
      playerCount: game.players.length
    });

    this.sendPlayersUpdate(game);
  }

  private startGame(socket: WebSocket, data: any) {
    const userId = this.users.get(socket);
    const game = this.gamesById.get(data.gameId);

    if (!game || game.hostId !== userId) return;

    game.currentQuestion = 0;
    game.status = 'in_progress';

    this.sendQuestion(game);
  }

  private answer(socket: WebSocket, data: any) {
    const userId = this.users.get(socket);
    const game = this.gamesById.get(data.gameId);

    if (!userId || !game) return;

    if (this.answers.has(userId)) return;

    this.answers.set(userId, data.answerIndex);
    this.answerTime.set(userId, Date.now());

    this.send(socket, RequestType.ANSWER_ACCEPTED, {
      questionIndex: data.questionIndex
    });

    const allAnswered = game.players.every(p => this.answers.has(p.index));

    if (allAnswered) {
      clearTimeout(this.timers.get(game.id));
      this.processResults(game);
    }
  }

  private processResults(game: Game) {
    const q = game.questions[game.currentQuestion];
    const start = this.questionStart.get(game.id)!;

    const playerResults = game.players.map(p => {
      const ans = this.answers.get(p.index);

      let pointsEarned = 0;
      let correct = false;
      const answered = ans !== undefined;

      if (answered) {
        correct = ans === q.correctIndex;

        if (correct) {
          const time = (this.answerTime.get(p.index)! - start) / 1000;
          const ratio = Math.max(0, (q.timeLimitSec - time) / q.timeLimitSec);
          pointsEarned = Math.round(1000 * ratio);
        }
      }

      p.score += pointsEarned;

      return {
        name: p.name,
        answered,
        correct,
        pointsEarned,
        totalScore: p.score
      };
    });

    this.broadcast(game, RequestType.QUESTION_RESULT, {
      questionIndex: game.currentQuestion,
      correctIndex: q.correctIndex,
      playerResults
    });

    this.resetRound(game);

    if (game.currentQuestion >= game.questions.length - 1) {
      this.finishGame(game);
      return;
    }

    game.currentQuestion++;
    this.sendQuestion(game);
  }

  private finishGame(game: Game) {
    const sorted = [...game.players].sort((a, b) => b.score - a.score);

    const scoreboard = sorted.map((p, i) => ({
      name: p.name,
      score: p.score,
      rank: i + 1
    }));

    this.broadcast(game, RequestType.GAME_FINISHED, { scoreboard });
  }

  private sendPlayersUpdate(game: Game) {
    const data = game.players.map(p => ({
        name: p.name,
        index: p.index,
        score: p.score
    }));

    this.broadcast(game, RequestType.UPDATE_PLAYERS, data);
  }

  private resetRound(game: Game) {
    game.players.forEach(p => {
      this.answers.delete(p.index);
      this.answerTime.delete(p.index);
    });

    this.timers.delete(game.id);
  }

  private sendQuestion(game: Game) {
    const q = game.questions[game.currentQuestion];

    this.broadcast(game, RequestType.QUESTION, {
      questionNumber: String(game.currentQuestion),
      totalQuestions: String(game.questions.length),
      text: q.text,
      options: q.options,
      timeLimitSec: String(q.timeLimitSec)
    });

    this.questionStart.set(game.id, Date.now());

    const timer = setTimeout(() => {
      this.processResults(game);
    }, q.timeLimitSec * 1000);

    this.timers.set(game.id, timer);
  }

  private broadcast(game: Game, type: RequestType, data: any) {
    const response = {
      type,
      data: data,
      id: 0
    };

    const sockets = new Set<WebSocket>();

    game.players.forEach(p => {
      const s = this.sockets.get(p.index);
      if (s) sockets.add(s);
    });

    const hostSocket = this.sockets.get(game.hostId);
    if (hostSocket) sockets.add(hostSocket);

    sockets.forEach(s => s.send(JSON.stringify(response)));
  }

  private send(socket: WebSocket, type: RequestType, data: any) {
    const response = {
      type,
      data: data,
      id: 0
    };

    socket.send(JSON.stringify(response));
  }
}

new GameManager(3000);
