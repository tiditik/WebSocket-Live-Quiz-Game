export interface Question {
  text: string;
  options: string[];       // ровно 4 варианта
  correctIndex: number;    // индекс правильного варианта (0-3)
  timeLimitSec: number;    // лимит времени на вопрос в секундах
}