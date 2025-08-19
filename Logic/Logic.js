// constants
const OUTCOME = { WIN: 1, DRAW: 0, LOSS: 2 };

const WIN_PATTERNS = [
  0b000000111,
  0b000111000,
  0b111000000, // rows
  0b001001001,
  0b010010010,
  0b100100100, // columns
  0b100010001,
  0b001010100, // diagonals
];

// ----------------------------
// Helper Functions
// ----------------------------
/**
 * Checks if adding a move (bit) to mask results in a win.
 */
function checkWin(mask) {
  return WIN_PATTERNS.some((pattern) => (mask & pattern) === pattern);
}

// export for CommonJS
module.exports = {
  OUTCOME,
  WIN_PATTERNS,
  checkWin,
};
