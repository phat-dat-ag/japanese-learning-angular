import { isRecord } from '../../../core/api/api-response.model';
import { Flashcard, isFlashcard } from './flashcard.model';

// Wire contracts from Quarkus META-INF/openapi.yaml; guards validate remote JSON.
export type LearningStatus = 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED';
export type SessionMode = 'NEW_AND_DUE' | 'DUE' | 'ALL';
export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
export type ReviewRating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';
export interface ProgressState {
  readonly status: LearningStatus;
  readonly successfulRepetitionCount: number;
  readonly lapseCount: number;
  readonly intervalSeconds: number;
  readonly easeFactor: number;
  readonly version: number;
  readonly lastReviewedAt?: string | null;
  readonly nextReviewAt?: string | null;
  readonly masteredAt?: string | null;
}
export interface LearningScope {
  readonly level?: string;
  readonly lessonId?: number;
}
export interface SessionCreateRequest {
  readonly lessonId: number;
  readonly mode?: SessionMode;
  readonly cardLimit?: number;
  readonly shuffle?: boolean;
}
export interface SessionSummary {
  readonly sessionId: number;
  readonly lessonId: number;
  readonly mode: SessionMode;
  readonly status: SessionStatus;
  readonly itemCount: number;
  readonly completedCount: number;
  readonly currentPosition: number;
  readonly createdAt: string;
  readonly completedAt?: string | null;
  readonly abandonedAt?: string | null;
}
export interface SessionItem {
  readonly itemId: number;
  readonly vocabularyId: number;
  readonly position: number;
  readonly completedAt?: string | null;
  readonly progress: ProgressState;
}
export interface SessionDetail extends SessionSummary {
  readonly items: readonly SessionItem[];
}
export type SessionCreated =
  | { readonly outcome: 'CREATED'; readonly eligibleCount: number; readonly session: SessionDetail }
  | { readonly outcome: 'NO_ELIGIBLE_CARDS'; readonly eligibleCount: 0; readonly session?: null };
export interface ReviewRequest {
  readonly rating: ReviewRating;
  readonly expectedProgressVersion: number;
}
export interface ReviewResponse {
  readonly reviewId: number;
  readonly sessionItemId: number;
  readonly vocabularyId: number;
  readonly rating: ReviewRating;
  readonly scheduling: boolean;
  readonly progress: ProgressState;
  readonly reviewedAt: string;
}
export interface PersonalCard {
  readonly id: number;
  readonly word: string;
  readonly progress: ProgressState;
  readonly bookmarked: boolean;
}
export interface PersonalDetail extends Flashcard {
  readonly progress: ProgressState;
  readonly bookmarked: boolean;
}
export interface BookmarkResponse {
  readonly vocabularyId: number;
  readonly bookmarked: boolean;
}
export interface LearningPage<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}
export interface LearningStatistics {
  readonly totalVocabularyCount: number;
  readonly newCount: number;
  readonly learningCount: number;
  readonly reviewCount: number;
  readonly masteredCount: number;
  readonly dueCount: number;
  readonly studiedCount: number;
  readonly totalReviewAttempts: number;
  readonly rememberedCount: number;
  readonly forgottenCount: number;
  readonly scheduledReviewAttempts: number;
  readonly practiceReviewAttempts: number;
  readonly studiedPercentage: number;
  readonly masteryPercentage: number;
}

export const isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export const isId = (v: unknown): v is number => isCount(v) && v > 0;
const isDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v));
const optionalDate = (v: unknown): boolean => v == null || isDate(v);
const member = (v: unknown, values: readonly string[]): boolean =>
  typeof v === 'string' && values.includes(v);

export function isProgress(v: unknown): v is ProgressState {
  return (
    isRecord(v) &&
    member(v['status'], ['NEW', 'LEARNING', 'REVIEW', 'MASTERED']) &&
    ['successfulRepetitionCount', 'lapseCount', 'intervalSeconds', 'version'].every((k) =>
      isCount(v[k]),
    ) &&
    typeof v['easeFactor'] === 'number' &&
    v['easeFactor'] >= 1.3 &&
    v['easeFactor'] <= 3 &&
    ['lastReviewedAt', 'nextReviewAt', 'masteredAt'].every((k) => optionalDate(v[k]))
  );
}
export function isSessionSummary(v: unknown): v is SessionSummary {
  return (
    isRecord(v) &&
    isId(v['sessionId']) &&
    isId(v['lessonId']) &&
    member(v['mode'], ['NEW_AND_DUE', 'DUE', 'ALL']) &&
    member(v['status'], ['IN_PROGRESS', 'COMPLETED', 'ABANDONED']) &&
    isId(v['itemCount']) &&
    v['itemCount'] <= 100 &&
    isCount(v['completedCount']) &&
    v['completedCount'] <= v['itemCount'] &&
    v['currentPosition'] === v['completedCount'] &&
    isDate(v['createdAt']) &&
    optionalDate(v['completedAt']) &&
    optionalDate(v['abandonedAt']) &&
    (v['status'] !== 'COMPLETED' ||
      (v['completedCount'] === v['itemCount'] && isDate(v['completedAt']))) &&
    (v['status'] !== 'ABANDONED' || isDate(v['abandonedAt']))
  );
}
export function isSessionDetail(v: unknown): v is SessionDetail {
  if (!isSessionSummary(v) || !isRecord(v) || !Array.isArray(v['items'])) return false;
  const ids = new Set<number>();
  const vocabulary = new Set<number>();
  return (
    v['items'].length === v.itemCount &&
    v['items'].every((item: unknown, index: number) => {
      if (
        !isRecord(item) ||
        !isId(item['itemId']) ||
        !isId(item['vocabularyId']) ||
        item['position'] !== index ||
        !isProgress(item['progress']) ||
        !optionalDate(item['completedAt']) ||
        index < v.completedCount !== isDate(item['completedAt']) ||
        ids.has(item['itemId']) ||
        vocabulary.has(item['vocabularyId'])
      )
        return false;
      ids.add(item['itemId']);
      vocabulary.add(item['vocabularyId']);
      return true;
    })
  );
}
export function isSessionCreated(v: unknown): v is SessionCreated {
  return (
    isRecord(v) &&
    (v['outcome'] === 'NO_ELIGIBLE_CARDS'
      ? v['eligibleCount'] === 0 && v['session'] == null
      : v['outcome'] === 'CREATED' &&
      isSessionDetail(v['session']) &&
      v['eligibleCount'] === v['session'].itemCount)
  );
}
export function isReviewResponse(v: unknown): v is ReviewResponse {
  return (
    isRecord(v) &&
    ['reviewId', 'sessionItemId', 'vocabularyId'].every((k) => isId(v[k])) &&
    member(v['rating'], ['AGAIN', 'HARD', 'GOOD', 'EASY']) &&
    typeof v['scheduling'] === 'boolean' &&
    isProgress(v['progress']) &&
    isDate(v['reviewedAt'])
  );
}
export function isPersonalCard(v: unknown): v is PersonalCard {
  return (
    isRecord(v) &&
    isId(v['id']) &&
    typeof v['word'] === 'string' &&
    isProgress(v['progress']) &&
    typeof v['bookmarked'] === 'boolean'
  );
}
export function isPersonalDetail(v: unknown): v is PersonalDetail {
  return (
    isFlashcard(v) &&
    isRecord(v) &&
    isProgress(v['progress']) &&
    typeof v['bookmarked'] === 'boolean'
  );
}
export function isBookmark(v: unknown): v is BookmarkResponse {
  return isRecord(v) && isId(v['vocabularyId']) && typeof v['bookmarked'] === 'boolean';
}
export function pageGuard<T>(guard: (v: unknown) => v is T): (v: unknown) => v is LearningPage<T> {
  return (v: unknown): v is LearningPage<T> =>
    isRecord(v) &&
    Array.isArray(v['items']) &&
    v['items'].every(guard) &&
    isCount(v['page']) &&
    isId(v['size']) &&
    v['size'] <= 100 &&
    v['items'].length <= v['size'] &&
    isCount(v['totalElements']) &&
    isCount(v['totalPages']) &&
    v['totalPages'] === Math.ceil(v['totalElements'] / v['size']);
}
export function isStatistics(v: unknown): v is LearningStatistics {
  return (
    isRecord(v) &&
    [
      'totalVocabularyCount',
      'newCount',
      'learningCount',
      'reviewCount',
      'masteredCount',
      'dueCount',
      'studiedCount',
      'totalReviewAttempts',
      'rememberedCount',
      'forgottenCount',
      'scheduledReviewAttempts',
      'practiceReviewAttempts',
    ].every((k) => isCount(v[k])) &&
    ['studiedPercentage', 'masteryPercentage'].every(
      (k) => typeof v[k] === 'number' && Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= 100,
    )
  );
}
