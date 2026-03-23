import type { Player } from "./player";
import { type Question } from "./question";

export interface Game {
  id: string;
  code: string;            // 6-символьный буквенно-цифровой код
  hostId: number | string;
  questions: Question[];
  players: Player[];
  currentQuestion: number; // индекс текущего вопроса (-1 до начала)
  status: 'waiting' | 'in_progress' | 'finished';
}