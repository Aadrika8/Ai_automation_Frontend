/* Names for the data-quality warnings, kept apart from the components that
   draw them so either can change without the other. */

/** The short name each warning goes by where there is room for only a few
    words — a pill on the load dialog. The full sentence always travels with
    it in a callout, so these name the finding rather than explain it. */
export const WARNING_LABELS: Record<string, string> = {
  conflicting_duplicate: 'Conflicting rows',
  text_in_measure: 'Text in a count',
  measure_column_not_numeric: 'Count holds text',
  mismatched_id: 'ID mismatch',
  identical_workbooks: 'Identical workbooks',
  duplicate_rows: 'Duplicate rows',
  separator_rows: 'Separator rows',
  empty_columns: 'Empty columns',
  sparse_columns: 'Sparse columns',
  no_header: 'No header row',
}

/** A code the screen has no name for yet still reads as words, not an id. */
export function warningLabel(code: string): string {
  const known = WARNING_LABELS[code]
  if (known) return known
  const words = code.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
