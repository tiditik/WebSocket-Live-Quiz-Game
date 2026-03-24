export const RequestType = {
  REGISTER_USER: 'reg',
  CREATE_GAME: 'create_game',
  GAME_CREATED: 'game_created',
  JOIN_GAME: 'join_game',
  GAME_JOINED: 'game_joined',
  PLAYER_JOINED: 'player_joined',
  UPDATE_PLAYERS: 'update_players',
  EXPORT_QUESTIONS: 'export_questions',
  QUESTIONS_EXPORTED: 'questions_exported',
  IMPORT_QUESTIONS: 'import_questions',
  QUESTION_IMPORTED: 'questions_imported',
  START_GAME: 'start_game',
  QUESTION: 'question',
  ANSWER: 'answer',
  ANSWER_ACCEPTED: 'answer_accepted',
  QUESTION_RESULT: 'question_result',
  GAME_FINISHED: 'game_finished'
} as const;

export type RequestType = typeof RequestType[keyof typeof RequestType];