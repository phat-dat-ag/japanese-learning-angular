// Match Jakarta NotBlank's Java whitespace rules without trimming submitted values.
export function validVocabularyText(value: string, maxLength: number): boolean {
  return (
    value.length <= maxLength &&
    /[^\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]/u.test(
      value,
    )
  );
}
