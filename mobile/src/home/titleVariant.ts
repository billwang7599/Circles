// A title's type steps down with its length so its tracking and line height
// always match: auto-shrinking keeps Display's values at a smaller size and
// crushes the letters together. In a 350 pt column Display holds about
// twelve characters a line and Display Small fifteen; `small` is the longest
// title Display Small gets, lower where the column is narrower. Titles get
// three lines, so a word that will not split still fits.
export const titleVariant = (title: string, small = 28) =>
  title.length <= 20
    ? "display"
    : title.length <= small
      ? "displaySmall"
      : "title";
