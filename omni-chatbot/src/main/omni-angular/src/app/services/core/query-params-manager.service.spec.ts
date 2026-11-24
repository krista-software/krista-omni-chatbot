import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { take } from 'rxjs/operators';
import { QueryParamsManagerService } from './query-params-manager.service';
import { PersonAttributesService } from '../person-attributes.service';

describe('QueryParamsManagerService', () => {
  let service: QueryParamsManagerService;
  let personAttributes: jasmine.SpyObj<PersonAttributesService>;

  beforeEach(() => {
    personAttributes = jasmine.createSpyObj<PersonAttributesService>(
      'PersonAttributesService', ['upsertPersonAttributes']);
    personAttributes.upsertPersonAttributes.and.returnValue(of({ success: true }));

    TestBed.configureTestingModule({
      providers: [
        QueryParamsManagerService,
        { provide: PersonAttributesService, useValue: personAttributes }
      ]
    });
    service = TestBed.inject(QueryParamsManagerService);
    service.initialize();
  });

  /** Dispatch a window 'message' event carrying a JSON STRING payload — the
   *  listener ignores already-parsed objects, so the data must be stringified. */
  function postMessageJson(payload: object): void {
    window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) }));
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('attributesDelivered$', () => {
    it('emits the delivered metadata on DATA_TO_CHATBOT', (done) => {
      service.attributesDelivered$.pipe(take(1)).subscribe(attrs => {
        expect(attrs['ACCOUNT_ID']).toBe('001');
        done();
      });
      postMessageJson({ messageType: 'dataToChatbot', metadata: { ACCOUNT_ID: '001' }, queryParams: {} });
    });

    it('emits an empty object on DATA_TO_CHATBOT when the host sent no metadata', (done) => {
      service.attributesDelivered$.pipe(take(1)).subscribe(attrs => {
        expect(Object.keys(attrs).length).toBe(0);
        done();
      });
      postMessageJson({ messageType: 'dataToChatbot', metadata: {}, queryParams: {} });
    });

    it('emits the delivered metadata on CHATBOT_ICON_CLICKED (old launcher)', (done) => {
      service.attributesDelivered$.pipe(take(1)).subscribe(attrs => {
        expect(attrs['ACCOUNT_ID']).toBe('xyz');
        done();
      });
      postMessageJson({ messageType: 'chatbotIconClicked', metadata: { ACCOUNT_ID: 'xyz' } });
    });

    it('filters excluded params out of the delivered attributes', (done) => {
      service.attributesDelivered$.pipe(take(1)).subscribe(attrs => {
        expect(attrs['ACCOUNT_ID']).toBe('001');
        expect('version' in attrs).toBeFalse();
        done();
      });
      postMessageJson({ messageType: 'dataToChatbot', metadata: { ACCOUNT_ID: '001', version: '9' }, queryParams: {} });
    });
  });

  describe('UPSERT_PERSON_ATTRIBUTES message', () => {
    it('calls upsertPersonAttributes with the filtered metadata', () => {
      postMessageJson({ messageType: 'upsertPersonAttributes', metadata: { ACCOUNT_ID: '001' } });
      expect(personAttributes.upsertPersonAttributes)
        .toHaveBeenCalledWith(jasmine.objectContaining({ ACCOUNT_ID: '001' }));
    });

    it('does not call upsertPersonAttributes when metadata is empty', () => {
      postMessageJson({ messageType: 'upsertPersonAttributes', metadata: {} });
      expect(personAttributes.upsertPersonAttributes).not.toHaveBeenCalled();
    });
  });
});
