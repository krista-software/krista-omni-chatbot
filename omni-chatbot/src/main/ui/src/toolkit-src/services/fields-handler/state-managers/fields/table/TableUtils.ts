export function createMatrix<T>(rows: number, cols: number): T[][] {
  const matrix: T[][] = new Array(rows);
  for (let i = 0; i < rows; i++) {
    matrix[i] = new Array(cols).fill(undefined);
  }
  return matrix;
}
