import type { Player } from "./interfaces/player";

class Server {
    private socket;
    private users: Player[] = [];

    constructor () {
        this.socket = new WebSocket("ws://localhost:65311");
        this.socket.addEventListener('open', this.openSocket.bind(this));
        this.socket.addEventListener('close', this.closeSocket.bind(this));
        this.socket.addEventListener('error', this.errorSocket.bind(this));
        this.socket.addEventListener('message', this.socketMessage.bind(this));

        this.checkConnection();
    }

    private checkConnection() {
        setTimeout(() => {
            if (this.socket.readyState === WebSocket.OPEN) {
                console.log("WebSocket IS OPEN: ws://localhost:65311")
            } else if (this.socket.readyState === WebSocket.CONNECTING) {
                console.log("WebSocket is connection...");
            } else {
                console.log("WebSocket not connected");
            }
        }, 100);
    }

    private openSocket(event: Event) {
        console.log('WebSocket connection estabilished');
        this.socket.send('Hello Server');
    }

    private closeSocket(event: CloseEvent) {
        console.log('WebSocket connection closed:', event.code, event.reason);
    }

    private errorSocket(event: Event) {
        console.error('WebSocket error:', event);
    }

    private socketMessage(event: MessageEvent) {
        console.log('Message from server: ', event.data);
    }
}


let s1 = new Server();