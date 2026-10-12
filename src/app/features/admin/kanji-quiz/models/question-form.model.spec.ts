import {
  createQuestionForm,
  parseQuestionIds,
  questionContent,
  selectedTarget,
  validateQuestion,
  validateAnswerOptions,
} from './question-form.model';

function validValue() {
  return {
    ...createQuestionForm().getRawValue(),
    sentenceReading: '😀がっこうへいく',
    targetStart: 1,
    targetLength: 4,
    targetReading: 'がっこう',
    options: ['学校', '学生', '先生', '電車'],
    correctIndex: 0,
  };
}

describe('Question form contracts', () => {
  it('converts supplementary-character UTF-16 selections to zero-based code points', () => {
    expect(selectedTarget('😀がっこうへいく', 2, 6)).toEqual({
      targetStart: 1,
      targetLength: 4,
      targetReading: 'がっこう',
    });
    expect(selectedTarget('𛀁かな', 0, 3)).toEqual({
      targetStart: 0,
      targetLength: 2,
      targetReading: '𛀁か',
    });
    expect(selectedTarget('か\u3099く', 0, 2)?.targetLength).toBe(2);
  });
  it.each([
    [0, 1],
    [1, 3],
    [2, 2],
    [-1, 3],
    [0, 99],
  ])('rejects empty, invalid, or split-surrogate selection %s:%s', (start, end) => {
    expect(selectedTarget('😀かな', start, end)).toBeNull();
  });
  it('validates exact kana segments without normalizing the source', () => {
    expect(validateQuestion(validValue(), true)).toEqual({});
    expect(validateQuestion({ ...validValue(), targetStart: 0 }, true).targetReading).toBeDefined();
    expect(
      validateQuestion({ ...validValue(), targetLength: 999 }, true).targetLength,
    ).toBeDefined();
    expect(
      validateQuestion({ ...validValue(), targetReading: '学校' }, true).targetReading,
    ).toBeDefined();
    expect(
      validateQuestion({ ...validValue(), targetStart: 999 }, true).targetLength,
    ).toBeDefined();
    expect(
      validateQuestion(
        {
          ...validValue(),
          sentenceReading: 'か\u3099',
          targetStart: 0,
          targetLength: 2,
          targetReading: 'が',
        },
        true,
      ).targetReading,
    ).toBeDefined();
    expect(
      validateQuestion(
        {
          ...validValue(),
          sentenceReading: '𛀁かな',
          targetStart: 0,
          targetLength: 1,
          targetReading: '𛀁',
        },
        true,
      ),
    ).toEqual({});
  });
  it('counts text limits in code points and rejects malformed Unicode', () => {
    expect(validateQuestion({ ...validValue(), explanationEn: '😀'.repeat(2000) }, true)).toEqual(
      {},
    );
    expect(
      validateQuestion({ ...validValue(), explanationEn: '😀'.repeat(2001) }, true).explanationEn,
    ).toBeDefined();
    expect(
      validateQuestion({ ...validValue(), sentenceReading: 'あ'.repeat(1001) }, true)
        .sentenceReading,
    ).toBeDefined();
    expect(
      validateQuestion({ ...validValue(), explanationVi: '\uD800' }, true).explanationVi,
    ).toBeDefined();
  });
  it('requires four NFKC-distinct options without surrounding whitespace and one correct choice', () => {
    for (const options of [
      ['Ａ', 'A', 'B', 'C'],
      [' 学校', '学生', '先生', '電車'],
      ['', 'B', 'C', 'D'],
      ['a'.repeat(201), 'B', 'C', 'D'],
    ]) {
      expect(validateQuestion({ ...validValue(), options }, true).options).toBeDefined();
    }
    expect(
      validateQuestion({ ...validValue(), correctIndex: null }, true).correctIndex,
    ).toBeDefined();
    expect(validateQuestion({ ...validValue(), options: [], correctIndex: null }, false)).toEqual(
      {},
    );
  });
  it('validates classification IDs and builds complete replacement payloads', () => {
    expect(parseQuestionIds('1, 2')).toEqual([1, 2]);
    for (const ids of [
      '1,1',
      '-1',
      '1.5',
      '9007199254740992',
      '1,',
      Array.from({ length: 101 }, (_, i) => i + 1).join(','),
    ])
      expect(parseQuestionIds(ids)).toBeNull();
    expect(questionContent(validValue())).toEqual({
      sourceType: 'CUSTOM',
      sentenceReading: '😀がっこうへいく',
      targetStart: 1,
      targetLength: 4,
      targetReading: 'がっこう',
      levelIds: [],
      lessonIds: [],
      vocabularyId: undefined,
      explanationVi: undefined,
      explanationEn: undefined,
    });
    const value = { ...validValue(), sourceType: 'EXAMPLE' as const, exampleId: 7 };
    expect(questionContent(value)).not.toHaveProperty('sentenceReading');
    expect(validateQuestion(value, true, '😀がっこうへいく')).toEqual({});
    expect(validateQuestion({ ...value, exampleId: null }, true).exampleId).toBeDefined();
    expect(validateQuestion(value, true, '')).toHaveProperty('sentenceReading');
  });
});

describe('Answer option invariants', () => {
  const options = ['A', 'B', 'C', 'D'].map((text, index) => ({ text, correct: index === 0 }));
  it('accepts exactly four distinct nonblank options with one correct answer', () => {
    expect(validateAnswerOptions(options)).toEqual({});
  });
  it.each(
    [[], options.slice(0, 3), [...options, { text: 'E', correct: false }]].map((values) => ({
      values,
    })),
  )('rejects an incorrect option count', ({ values }) => {
    expect(validateAnswerOptions(values).options).toBeDefined();
  });
  it.each(['', '   ', 'B', '\uFF22'])(
    'rejects blank or NFKC-equivalent duplicate text: %s',
    (text) => {
      expect(
        validateAnswerOptions(
          options.map((option, index) => (index === 0 ? { ...option, text } : option)),
        ).options,
      ).toBeDefined();
    },
  );
  it.each([0, 2, 4])('rejects %s correct answers', (count) => {
    expect(
      validateAnswerOptions(options.map((option, index) => ({ ...option, correct: index < count })))
        .correctIndex,
    ).toBeDefined();
  });
});
