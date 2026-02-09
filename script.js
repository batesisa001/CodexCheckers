const BOARD_SIZE = 8;
const RED = "red";
const BLACK = "black";
const DIRECTIONS = {
  red: [{ row: -1, col: -1 }, { row: -1, col: 1 }],
  black: [{ row: 1, col: -1 }, { row: 1, col: 1 }],
};

const boardElement = document.getElementById("board");
const turnIndicator = document.getElementById("turnIndicator");
const forcedIndicator = document.getElementById("forcedIndicator");
const moveCounter = document.getElementById("moveCounter");
const gameStatus = document.getElementById("gameStatus");
const moveHistoryElement = document.getElementById("moveHistory");
const undoButton = document.getElementById("undoButton");
const restartButton = document.getElementById("restartButton");

let state = null;

const cloneBoard = (board) => board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));

const createInitialBoard = () => {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { color: BLACK, king: false };
      }
    }
  }

  for (let row = BOARD_SIZE - 3; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { color: RED, king: false };
      }
    }
  }

  return board;
};

const initialState = () => ({
  board: createInitialBoard(),
  currentPlayer: RED,
  selected: null,
  validMoves: [],
  forcedPiece: null,
  moveHistory: [],
  moveCount: 0,
  historyStack: [],
  gameOver: false,
  statusMessage: "Ready to play",
  statusIsError: false,
});

const withinBounds = (row, col) => row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;

const getDirections = (piece) => {
  if (piece.king) {
    return [...DIRECTIONS.red, ...DIRECTIONS.black];
  }
  return DIRECTIONS[piece.color];
};

const getPieceMoves = (board, row, col, onlyCaptures = false) => {
  const piece = board[row][col];
  if (!piece) return [];
  const moves = [];

  getDirections(piece).forEach(({ row: dRow, col: dCol }) => {
    const nextRow = row + dRow;
    const nextCol = col + dCol;
    const jumpRow = row + dRow * 2;
    const jumpCol = col + dCol * 2;

    if (withinBounds(nextRow, nextCol) && !board[nextRow][nextCol] && !onlyCaptures) {
      moves.push({ toRow: nextRow, toCol: nextCol, capture: null });
    }

    if (
      withinBounds(jumpRow, jumpCol) &&
      board[nextRow]?.[nextCol] &&
      board[nextRow][nextCol].color !== piece.color &&
      !board[jumpRow][jumpCol]
    ) {
      moves.push({
        toRow: jumpRow,
        toCol: jumpCol,
        capture: { row: nextRow, col: nextCol },
      });
    }
  });

  return moves;
};

const getAllMoves = (board, player) => {
  const allMoves = [];
  let hasCaptures = false;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece && piece.color === player) {
        const moves = getPieceMoves(board, row, col);
        moves.forEach((move) => {
          if (move.capture) {
            hasCaptures = true;
          }
          allMoves.push({ fromRow: row, fromCol: col, ...move });
        });
      }
    }
  }

  if (hasCaptures) {
    return allMoves.filter((move) => move.capture);
  }

  return allMoves;
};

const getCapturesFromPosition = (board, row, col) =>
  getPieceMoves(board, row, col, true).filter((move) => move.capture);

const updateIndicators = () => {
  turnIndicator.textContent = state.currentPlayer === RED ? "Red" : "Black";
  turnIndicator.className = `turn-indicator ${state.currentPlayer}`;
  moveCounter.textContent = state.moveCount.toString();
  if (state.forcedPiece) {
    forcedIndicator.textContent = "Multi-jump required: keep capturing!";
  } else {
    forcedIndicator.textContent = "";
  }
};

const updateStatus = (message, isError = false) => {
  state.statusMessage = message;
  state.statusIsError = isError;
  gameStatus.textContent = message;
  gameStatus.style.color = isError ? "var(--danger)" : "inherit";
};

const addMoveHistoryEntry = (text) => {
  const entry = document.createElement("li");
  entry.textContent = text;
  moveHistoryElement.appendChild(entry);
  moveHistoryElement.scrollTop = moveHistoryElement.scrollHeight;
};

const clearMoveHistory = () => {
  moveHistoryElement.innerHTML = "";
};

const renderBoard = () => {
  boardElement.innerHTML = "";

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const square = document.createElement("div");
      const isDark = (row + col) % 2 === 1;
      square.className = `square ${isDark ? "dark" : "light"}`;
      square.dataset.row = row;
      square.dataset.col = col;
      square.setAttribute("role", "gridcell");

      const isSelected = state.selected && state.selected.row === row && state.selected.col === col;
      if (isSelected) {
        square.classList.add("selected");
      }

      const validMove = state.validMoves.find((move) => move.toRow === row && move.toCol === col);
      if (validMove) {
        square.classList.add("valid");
      }

      const piece = state.board[row][col];
      if (piece) {
        const pieceElement = document.createElement("div");
        pieceElement.className = `piece ${piece.color}${piece.king ? " king" : ""}`;
        square.appendChild(pieceElement);
      }

      boardElement.appendChild(square);
    }
  }
};

const saveSnapshot = () => {
  state.historyStack.push({
    board: cloneBoard(state.board),
    currentPlayer: state.currentPlayer,
    selected: state.selected ? { ...state.selected } : null,
    validMoves: state.validMoves.map((move) => ({ ...move, capture: move.capture ? { ...move.capture } : null })),
    forcedPiece: state.forcedPiece ? { ...state.forcedPiece } : null,
    moveHistory: [...state.moveHistory],
    moveCount: state.moveCount,
    gameOver: state.gameOver,
    statusMessage: state.statusMessage,
    statusIsError: state.statusIsError,
  });
  undoButton.disabled = state.historyStack.length === 0;
};

const restoreSnapshot = () => {
  const snapshot = state.historyStack.pop();
  if (!snapshot) return;
  state.board = snapshot.board;
  state.currentPlayer = snapshot.currentPlayer;
  state.selected = snapshot.selected;
  state.validMoves = snapshot.validMoves;
  state.forcedPiece = snapshot.forcedPiece;
  state.moveHistory = snapshot.moveHistory;
  state.moveCount = snapshot.moveCount;
  state.gameOver = snapshot.gameOver;
  state.statusMessage = snapshot.statusMessage;
  state.statusIsError = snapshot.statusIsError;
  undoButton.disabled = state.historyStack.length === 0;
  clearMoveHistory();
  state.moveHistory.forEach(addMoveHistoryEntry);
  updateIndicators();
  renderBoard();
  updateStatus(state.statusMessage, state.statusIsError);
};

const crownIfNeeded = (piece, row) => {
  if (piece.king) return false;
  if (piece.color === RED && row === 0) {
    piece.king = true;
    return true;
  }
  if (piece.color === BLACK && row === BOARD_SIZE - 1) {
    piece.king = true;
    return true;
  }
  return false;
};

const coordsToLabel = (row, col) => {
  const columns = "ABCDEFGH";
  return `${columns[col]}${BOARD_SIZE - row}`;
};

const handleMove = (fromRow, fromCol, move) => {
  const piece = state.board[fromRow][fromCol];
  if (!piece) return;

  saveSnapshot();

  const newPiece = { ...piece };
  state.board[fromRow][fromCol] = null;
  state.board[move.toRow][move.toCol] = newPiece;

  let captureText = "";
  if (move.capture) {
    const { row: capRow, col: capCol } = move.capture;
    state.board[capRow][capCol] = null;
    captureText = "x";
  } else {
    captureText = "-";
  }

  const becameKing = crownIfNeeded(newPiece, move.toRow);

  const moveLabel = `${state.currentPlayer.toUpperCase()}: ${coordsToLabel(fromRow, fromCol)}${captureText}${coordsToLabel(
    move.toRow,
    move.toCol,
  )}${becameKing ? " (King)" : ""}`;
  state.moveHistory.push(moveLabel);
  addMoveHistoryEntry(moveLabel);
  state.moveCount += 1;

  if (move.capture) {
    const furtherCaptures = getCapturesFromPosition(state.board, move.toRow, move.toCol);
    if (furtherCaptures.length > 0) {
      state.forcedPiece = { row: move.toRow, col: move.toCol };
      state.selected = state.forcedPiece;
      state.validMoves = furtherCaptures;
      updateIndicators();
      renderBoard();
      updateStatus("Capture again with the same piece.");
      return;
    }
  }

  state.forcedPiece = null;
  state.selected = null;
  state.validMoves = [];
  state.currentPlayer = state.currentPlayer === RED ? BLACK : RED;
  updateIndicators();

  const opponentMoves = getAllMoves(state.board, state.currentPlayer);
  const opponentPieces = state.board.flat().filter((piece) => piece && piece.color === state.currentPlayer).length;

  if (opponentPieces === 0 || opponentMoves.length === 0) {
    state.gameOver = true;
    updateStatus(`${state.currentPlayer === RED ? "Black" : "Red"} wins!`);
  } else {
    updateStatus("Select a piece to move.");
  }

  renderBoard();
};

const selectPiece = (row, col) => {
  if (state.gameOver) return;
  const piece = state.board[row][col];
  if (!piece || piece.color !== state.currentPlayer) {
    updateStatus("Select one of your own pieces.", true);
    return;
  }

  if (state.forcedPiece && (state.forcedPiece.row !== row || state.forcedPiece.col !== col)) {
    updateStatus("You must continue capturing with the highlighted piece.", true);
    return;
  }

  const moves = getPieceMoves(state.board, row, col);
  const mandatoryMoves = getAllMoves(state.board, state.currentPlayer);
  const capturingOnly = mandatoryMoves.some((move) => move.capture);
  const filteredMoves = capturingOnly ? moves.filter((move) => move.capture) : moves;

  if (filteredMoves.length === 0) {
    if (capturingOnly) {
      updateStatus("Captures are mandatory. Choose a capturing piece.", true);
    } else {
      updateStatus("That piece has no legal moves.", true);
    }
    return;
  }

  state.selected = { row, col };
  state.validMoves = filteredMoves;
  updateStatus("Choose a destination highlighted in green.");
  renderBoard();
};

const handleBoardClick = (event) => {
  const target = event.target.closest(".square");
  if (!target) return;
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);

  const isSelected = state.selected && state.selected.row === row && state.selected.col === col;
  if (isSelected) {
    state.selected = null;
    state.validMoves = [];
    updateStatus("Selection cleared.");
    renderBoard();
    return;
  }

  const move = state.validMoves.find((candidate) => candidate.toRow === row && candidate.toCol === col);
  if (move && state.selected) {
    handleMove(state.selected.row, state.selected.col, move);
    return;
  }

  selectPiece(row, col);
};

const startGame = () => {
  state = initialState();
  updateIndicators();
  updateStatus("Select a piece to move.");
  clearMoveHistory();
  undoButton.disabled = true;
  renderBoard();
};

undoButton.addEventListener("click", () => {
  if (state.historyStack.length === 0) return;
  restoreSnapshot();
});

restartButton.addEventListener("click", startGame);
boardElement.addEventListener("click", handleBoardClick);

startGame();
