export interface VocabularyExampleUpdateRequest {
  readonly japaneseText: string;
  readonly japaneseReading: string;
  readonly meaningVi: string;
  readonly meaningEn: string;
  readonly targetText: string;
  readonly displayOrder: number;
}

export interface KanjiUpdateRequest {
  readonly character: string;
  readonly strokeCount: number | null;
  readonly meaningVi: string | null;
  readonly meaningEn: string | null;
  readonly displayOrder: number;
}

export interface KanjiReadingUpdateRequest {
  readonly reading: string;
  readonly readingType: string;
  readonly displayOrder: number;
}
