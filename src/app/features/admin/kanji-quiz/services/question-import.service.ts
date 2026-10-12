import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  parseQuizImport,
  QuestionImportResult,
  validateQuizFile,
} from '../models/question-import.model';

@Injectable({ providedIn: 'root' })
export class QuestionImportService {
  preview(file: File): Observable<QuestionImportResult> {
    const error = validateQuizFile(file);
    if (error) return of({ status: 'error', message: error });
    return new Observable<QuestionImportResult>((subscriber) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          subscriber.next(
            typeof reader.result === 'string'
              ? parseQuizImport(reader.result)
              : { status: 'error', message: 'Unable to read this file as text. Select it again.' },
          );
        } catch {
          subscriber.next({
            status: 'error',
            message:
              'Unable to preview this JSON structure. Check the question fields and select the file again.',
          });
        }
        subscriber.complete();
      };
      reader.onerror = () => {
        subscriber.next({
          status: 'error',
          message: 'Unable to read the selected file. Retry or select it again.',
        });
        subscriber.complete();
      };
      try {
        reader.readAsText(file, 'UTF-8');
      } catch {
        subscriber.next({
          status: 'error',
          message: 'Unable to read the selected file. Retry or select it again.',
        });
        subscriber.complete();
      }
      return () => {
        reader.onload = null;
        reader.onerror = null;
        if (reader.readyState === FileReader.LOADING) reader.abort();
      };
    });
  }
}
