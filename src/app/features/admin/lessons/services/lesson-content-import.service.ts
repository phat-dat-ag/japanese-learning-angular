import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client.service';
import {
  GrammarImportMode,
  GrammarImportPreview,
  isGrammarImportResponse,
  parseGrammarImport,
  validateGrammarImportFile,
} from '../models/lesson-import.model';

@Injectable({ providedIn: 'root' })
export class LessonContentImportService {
  private readonly api = inject(ApiClient);
  preview(file: File): Observable<GrammarImportPreview> {
    const error = validateGrammarImportFile(file);
    if (error) return of({ status: 'error', issues: [error] });
    return new Observable<GrammarImportPreview>((subscriber) => {
      const reader = new FileReader();
      const failed = (message: string) => {
        subscriber.next({ status: 'error', issues: [message] });
        subscriber.complete();
      };
      reader.onload = () => {
        try {
          if (!(reader.result instanceof ArrayBuffer)) {
            failed('Unable to read this file. Select it again.');
            return;
          }
          const text = new TextDecoder('utf-8', { fatal: true }).decode(reader.result);
          subscriber.next(parseGrammarImport(text));
          subscriber.complete();
        } catch {
          failed(
            'Unable to validate this file. Check that it is UTF-8 JSON with the documented grammar structure.',
          );
        }
      };
      reader.onerror = () => failed('Unable to read the selected file. Select it again.');
      try {
        reader.readAsArrayBuffer(file);
      } catch {
        failed('Unable to read the selected file. Select it again.');
      }
      return () => {
        reader.onload = null;
        reader.onerror = null;
        if (reader.readyState === FileReader.LOADING) reader.abort();
      };
    });
  }
  importFile(file: File, mode: GrammarImportMode) {
    const body = new FormData();
    body.append('file', file);
    return this.api.post(`v1/lessons/content/import?mode=${mode}`, body, isGrammarImportResponse);
  }
}
