export var GameMode;
(function (GameMode) {
    GameMode["DUEL"] = "DUEL";
    GameMode["MULTI_DUEL"] = "MULTI_DUEL";
    GameMode["GAUNTLET"] = "GAUNTLET";
    GameMode["QUORDLE"] = "QUORDLE";
    GameMode["OCTORDLE"] = "OCTORDLE";
    GameMode["SEQUENCE"] = "SEQUENCE";
    GameMode["RESCUE"] = "RESCUE";
    GameMode["TOURNAMENT"] = "TOURNAMENT";
    GameMode["PROPERNOUNDLE"] = "PROPERNOUNDLE";
    GameMode["DUEL_6"] = "DUEL_6";
    GameMode["DUEL_7"] = "DUEL_7";
})(GameMode || (GameMode = {}));
export var TileState;
(function (TileState) {
    TileState["CORRECT"] = "CORRECT";
    TileState["PRESENT"] = "PRESENT";
    TileState["ABSENT"] = "ABSENT";
    TileState["EMPTY"] = "EMPTY";
    TileState["HINT_USED"] = "HINT_USED";
})(TileState || (TileState = {}));
export var GameStatus;
(function (GameStatus) {
    GameStatus["PLAYING"] = "PLAYING";
    GameStatus["WON"] = "WON";
    GameStatus["LOST"] = "LOST";
    GameStatus["ABANDONED"] = "ABANDONED";
})(GameStatus || (GameStatus = {}));
export const GAUNTLET_STAGES = [
    { stageIndex: 0, name: 'The Opening', baseMode: GameMode.DUEL, boardCount: 1, maxGuesses: 6, sequential: false, hasPrefill: false },
    { stageIndex: 1, name: 'QuadWord', baseMode: GameMode.QUORDLE, boardCount: 4, maxGuesses: 9, sequential: false, hasPrefill: false },
    { stageIndex: 2, name: 'Succession', baseMode: GameMode.SEQUENCE, boardCount: 4, maxGuesses: 10, sequential: true, hasPrefill: false },
    { stageIndex: 3, name: 'Deliverance', baseMode: GameMode.RESCUE, boardCount: 4, maxGuesses: 6, sequential: false, hasPrefill: true },
    { stageIndex: 4, name: 'OctoWord', baseMode: GameMode.OCTORDLE, boardCount: 8, maxGuesses: 13, sequential: false, hasPrefill: false },
];
export const GAUNTLET_TOTAL_SOLUTIONS = GAUNTLET_STAGES.reduce((sum, s) => sum + s.boardCount, 0);
