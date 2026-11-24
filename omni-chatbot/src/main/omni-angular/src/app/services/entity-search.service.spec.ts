import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { EntitySearchService } from './entity-search.service';
import { StorageService } from './storage.service';
import { AppConfig } from '../config/app.config';
import { environment } from '../../environments/environment';
import { FormField } from '../models/message.model';
import { EntitySearchDto, EntitySearchResponse } from '../models/entity.model';

/**
 * Regression tests for KR-21136: entity search (Selection field) returned
 * 404 from nginx because the service hand-built its URL from the dead
 * window.AppConfig global with a hardcoded dev routing-id fallback, instead
 * of going through ApiService (window.basePath-derived routing path).
 *
 * These tests intercept the REAL outgoing HTTP request, so any future drift
 * back to a hand-rolled URL or dropped session headers fails immediately.
 */
describe('EntitySearchService', () => {
  /** The dev routing id that was hardcoded in the buggy version. */
  const LEGACY_HARDCODED_ROUTING_ID = 'A_pR4e9i1qxSCWDPK5rDuig_e_e';

  let service: EntitySearchService;
  let httpMock: HttpTestingController;
  let storageService: StorageService;

  const makeSourceField = (): FormField => ({
    name: 'Customer',
    fieldType: 'EntitySelector',
    attributeValues: {
      entityDefinition: {
        fields: [
          { name: 'name', fieldType: 'TextField' },
          { name: 'city', fieldType: 'TextField' }
        ]
      },
      filters: [{ frontendOnly: true }],
      alwaysSynthesizeInTestMode: true
    }
  });

  const makeSearchDto = (): EntitySearchDto =>
    service.createSearchDto(makeSourceField(), 'name', 'acme', 0, 20);

  const search = (): { responses: EntitySearchResponse[]; completed: boolean } => {
    const captured = { responses: [] as EntitySearchResponse[], completed: false };
    service.searchEntities(makeSearchDto()).subscribe({
      next: response => captured.responses.push(response),
      complete: () => (captured.completed = true)
    });
    return captured;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(EntitySearchService);
    httpMock = TestBed.inject(HttpTestingController);
    storageService = TestBed.inject(StorageService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('request URL (the KR-21136 bug)', () => {
    it('POSTs to the ApiService-built URL derived from the routing base path', () => {
      search();

      // environment.chatbotRoutingId = AppConfig.getChatbotRoutingPath() = the
      // server-injected window.basePath (dev-config fallback in tests). The
      // endpoint must be appended to exactly that path.
      const expectedUrl = `${environment.chatbotRoutingId}${environment.apiEndpoints.searchEntities}`;
      const req = httpMock.expectOne(expectedUrl);
      expect(req.request.method).toBe('POST');
      req.flush({ results: [] });
    });

    it('uses the AppConfig routing path, never a hardcoded routing id', () => {
      search();

      const req = httpMock.expectOne(r => r.url.endsWith('/chatbot/entities/search'));
      expect(req.request.url.startsWith(AppConfig.getChatbotRoutingPath())).toBeTrue();
      expect(req.request.url).not.toContain(LEGACY_HARDCODED_ROUTING_ID);
      req.flush({ results: [] });
    });

    it('has the searchEntities endpoint registered in environment.apiEndpoints', () => {
      expect(environment.apiEndpoints.searchEntities).toBe('chatbot/entities/search');
    });
  });

  describe('authentication headers', () => {
    it('attaches Chatbot-Session-Id and X-Krista-Context when a session exists', () => {
      spyOn(storageService, 'getClientSessionId').and.returnValue('sess-123');

      search();

      const req = httpMock.expectOne(r => r.url.endsWith('/chatbot/entities/search'));
      expect(req.request.headers.get('Chatbot-Session-Id')).toBe('sess-123');
      expect(req.request.headers.get('X-Krista-Context'))
        .toBe(encodeURIComponent(JSON.stringify({ clientSessionId: 'sess-123' })));
      req.flush({ results: [] });
    });

    it('still sends the request (anonymously) when no session exists', () => {
      spyOn(storageService, 'getClientSessionId').and.returnValue(null);

      search();

      const req = httpMock.expectOne(r => r.url.endsWith('/chatbot/entities/search'));
      expect(req.request.headers.has('Chatbot-Session-Id')).toBeFalse();
      expect(req.request.headers.has('X-Krista-Context')).toBeFalse();
      req.flush({ results: [] });
    });
  });

  describe('request payload', () => {
    it('sends the search parameters and the serialized source field', () => {
      search();

      const req = httpMock.expectOne(r => r.url.endsWith('/chatbot/entities/search'));
      const body = req.request.body;
      expect(body.filterFieldName).toBe('name');
      expect(body.value).toBe('acme');
      expect(body.page).toBe(0);
      expect(body.count).toBe(20);
      expect(body.sourceField.name).toBe('Customer');
      req.flush({ results: [] });
    });

    it('converts entityDefinition.fields array to object and strips frontend-only metadata', () => {
      search();

      const req = httpMock.expectOne(r => r.url.endsWith('/chatbot/entities/search'));
      const attrs = req.request.body.sourceField.attributeValues;
      // Backend expects fields keyed by name, not an array
      expect(Array.isArray(attrs.entityDefinition.fields)).toBeFalse();
      expect(attrs.entityDefinition.fields['name']).toBeDefined();
      expect(attrs.entityDefinition.fields['city']).toBeDefined();
      // Frontend-only metadata must not leak to the backend
      expect(attrs.filters).toBeUndefined();
      expect(attrs.alwaysSynthesizeInTestMode).toBeUndefined();
      req.flush({ results: [] });
    });

    // Table -> Selection search (KR-21136 follow-up): the source field is the whole
    // TABLE field (the backend's table branch extracts meta.entity itself, same
    // contract as the 2.0.16 app). The nested meta.entity must get the same
    // normalization as a standalone selection field, because
    // EntitySelectorMetaParser mutates its entityDefinition.fields to an array
    // in place.
    it('serializes a TABLE source field with its nested meta.entity normalized', () => {
      const tableField: FormField = {
        name: 'Students',
        fieldType: 'com.krista.fields.Table',
        attributeValues: {
          allowAdd: true,
          meta: {
            columns: [],
            entity: {
              name: 'Entity',
              fieldType: 'com.krista.fields.Entity',
              attributeValues: {
                selectionSize: '1',
                invokeAsUser: true,
                entityTypeDomain: { entityId: 'e-1', entityName: 'Student' },
                entityDefinition: {
                  name: 'Student',
                  // Array shape = what EntitySelectorMetaParser leaves behind
                  fields: [
                    { name: 'Name', fieldType: 'com.krista.fields.Text' },
                    { name: 'Age', fieldType: 'com.krista.fields.Number' }
                  ]
                },
                filters: [{ fieldName: 'Name' }],
                alwaysSynthesizeInTestMode: true
              }
            }
          }
        }
      };

      service.searchEntities(service.createSearchDto(tableField, '', '', 1, 10)).subscribe();

      const req = httpMock.expectOne(r => r.url.endsWith('/chatbot/entities/search'));
      const sourceField = req.request.body.sourceField;
      // The table field itself is sent, with fieldType preserved for backend routing
      expect(sourceField.fieldType).toBe('com.krista.fields.Table');
      expect(sourceField.name).toBe('Students');

      const entityAttrs = sourceField.attributeValues.meta.entity.attributeValues;
      // Entity identity must survive for the backend's table branch
      expect(entityAttrs.entityTypeDomain).toEqual({ entityId: 'e-1', entityName: 'Student' });
      // Nested entityDefinition.fields restored to object shape
      expect(Array.isArray(entityAttrs.entityDefinition.fields)).toBeFalse();
      expect(entityAttrs.entityDefinition.fields['Name']).toBeDefined();
      expect(entityAttrs.entityDefinition.fields['Age']).toBeDefined();
      // Frontend-only metadata stripped from the nested entity too
      expect(entityAttrs.filters).toBeUndefined();
      expect(entityAttrs.alwaysSynthesizeInTestMode).toBeUndefined();
      req.flush({ results: [] });
    });
  });

  describe('response handling', () => {
    it('transforms a successful response (singular "result" key)', () => {
      const captured = search();

      const req = httpMock.expectOne(r => r.url.endsWith('/chatbot/entities/search'));
      req.flush({
        result: [{ meta: { id: '1' }, fields: { name: 'Acme', city: 'Pune' } }],
        hasMore: true
      });

      expect(captured.responses.length).toBe(1);
      const response = captured.responses[0];
      expect(response.status).toBe('success');
      expect(response.data?.results.length).toBe(1);
      expect(response.data?.results[0].textSummary).toBe('Acme • Pune');
      expect(response.data?.hasMore).toBeTrue();
      expect(captured.completed).toBeTrue();
    });

    it('handles an empty result set', () => {
      const captured = search();

      const req = httpMock.expectOne(r => r.url.endsWith('/chatbot/entities/search'));
      req.flush({ results: [] });

      expect(captured.responses[0].status).toBe('success');
      expect(captured.responses[0].data?.results).toEqual([]);
      expect(captured.responses[0].data?.hasMore).toBeFalse();
    });

    it('maps a backend error body to an error response', () => {
      const captured = search();

      const req = httpMock.expectOne(r => r.url.endsWith('/chatbot/entities/search'));
      req.flush({ status: 'error', errorMessage: 'Entity type not found' });

      expect(captured.responses[0]).toEqual({
        status: 'error',
        errorMessage: 'Entity type not found'
      });
      expect(captured.completed).toBeTrue();
    });

    it('maps an HTTP failure to an error response instead of throwing', () => {
      const captured = search();

      const req = httpMock.expectOne(r => r.url.endsWith('/chatbot/entities/search'));
      req.flush({ message: 'Server exploded' }, { status: 500, statusText: 'Server Error' });

      expect(captured.responses.length).toBe(1);
      expect(captured.responses[0].status).toBe('error');
      // ApiService.handleError extracts the server message into Error.message
      expect(captured.responses[0].errorMessage).toBe('Server exploded');
      expect(captured.completed).toBeTrue();
    });
  });

  describe('cancellation', () => {
    it('cancels the in-flight request on cancelSearch()', () => {
      const captured = search();

      const req = httpMock.expectOne(r => r.url.endsWith('/chatbot/entities/search'));
      service.cancelSearch();

      expect(req.cancelled).toBeTrue();
      expect(captured.responses.length).toBe(0);
      expect(captured.completed).toBeTrue();
    });
  });
});
