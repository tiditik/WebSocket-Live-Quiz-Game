import type { Game as IGame } from "./interfaces/game";
import type { Question } from "./interfaces/question";
import type { Player } from "./interfaces/player";


export default class Game implements IGame {
    id;
    code;
    hostId;
    players: Player[];
    currentQuestion;
    questions;
    status: 'waiting' | 'in_progress' | 'finished';

    private nextId = 1;

    constructor(id: string, hostId: string, questions: Question[]) {
        this.id = id;
        this.hostId = hostId;
        this.code = this._generateCode();
        this.players = [];
        this.currentQuestion = -1;
        this.questions = questions;
        this.status = 'waiting';
    }

    _generateCode(){
        return Math.random().toString(36).slice(2, 8).toUpperCase();
    }

    addPlayer(player: Player) {
        if (!this.players.find(p => p.index === player.index)) {
            this.players.push(player);
        }
    }
}