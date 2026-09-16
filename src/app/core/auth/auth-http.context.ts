import { HttpContextToken } from '@angular/common/http';

// Token endpoints must never enter the Bearer/refresh pipeline.
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
