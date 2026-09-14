import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiClient } from '../../../core/api/api-client.service';
import { isJlptLevelResponses, isSupportedJlptLevel, JlptLevel } from '../models/jlpt-level.model';

@Injectable({ providedIn: 'root' })
export class JlptLevelService {
  private readonly api = inject(ApiClient);

  getLevels(): Observable<readonly JlptLevel[]> {
    return this.api
      .get('jlpt-levels', isJlptLevelResponses)
      .pipe(map((response) => response.data.filter(isSupportedJlptLevel)));
  }
}
