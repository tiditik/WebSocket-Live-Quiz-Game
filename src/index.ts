import { WebSocketServer, WebSocket } from 'ws';
import type { Player } from "./interfaces/player";

class GameServer {
    private wss: WebSocketServer;
    private users: Player[] = [];

    constructor (port: number) {
        this.wss = new WebSocketServer({ port });
        
        this.wss.on('connection', (socket: WebSocket) => {
            console.log("Новое подключение!");

            socket.on('message', (data) => this.socketMessage(data, socket));
            socket.on('close', (code, reason) => this.closeSocket(code, reason));
            socket.on('error', (err) => this.errorSocket(err));

            this.openSocket(socket);
        });

        console.log(`Сервер запущен на ws://localhost:${port}`);
    }

    private openSocket(socket: WebSocket) {
        socket.send('Привет игрок! Welcome to Quiz');
    }

   private closeSocket(code: number, reason: Buffer) {
        console.log('WebSocket connection closed:', code, reason.toString());
    }

    private errorSocket(err: Error) {
        console.error('WebSocket error:', err.message);
    }

    private socketMessage(data: any, socket: WebSocket) {
        const message = data.toString();
        console.log('Message from player: ', message);
    }
}


const server = new GameServer(65311);