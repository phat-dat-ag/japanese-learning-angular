export interface FlashcardListQuery {
  readonly level?: string;
  readonly lesson?: number;
  readonly page: number;
  readonly size: number;
}
