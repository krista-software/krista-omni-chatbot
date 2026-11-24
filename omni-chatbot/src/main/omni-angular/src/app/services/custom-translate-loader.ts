import { HttpClient } from '@angular/common/http';
import { Inject } from '@angular/core';
import { APP_BASE_HREF } from '@angular/common';
import { TranslateLoader } from '@ngx-translate/core';
import { Observable } from 'rxjs';

/**
 * Custom TranslateLoader that constructs the correct path using APP_BASE_HREF
 *
 * HttpClient doesn't use APP_BASE_HREF for resolving relative URLs - it uses the
 * HTML <base> tag. Since our APP_BASE_HREF includes 'chatbot/ui/' but the HTML
 * base tag doesn't, we need to construct the full path manually.
 */
export class CustomTranslateLoader implements TranslateLoader {
  constructor(
    private http: HttpClient,
    @Inject(APP_BASE_HREF) private baseHref: string
  ) {}

  getTranslation(lang: string): Observable<any> {
    // Construct the full path using APP_BASE_HREF
    // APP_BASE_HREF is set to /extension/api/{routingId}/chatbot/ui/ in production
    // So this becomes /extension/api/{routingId}/chatbot/ui/assets/i18n/{lang}.json
    const path = `${this.baseHref}assets/i18n/${lang}.json`;

    return this.http.get(path);
  }
}

