import { GameState, GameAction, GameMode } from './types';
export declare function initializeGame(seed: string, mode: GameMode): GameState;
export declare function createInitialState(seed: string, mode: GameMode): GameState;
export declare function gameReducer(state: GameState, action: GameAction): GameState;
//# sourceMappingURL=reducer.d.ts.map