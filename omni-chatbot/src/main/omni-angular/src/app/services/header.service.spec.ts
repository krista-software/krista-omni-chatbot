import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HeaderService } from './header.service';
import { AuthApiService } from './auth-api.service';
import { StorageService } from './storage.service';

describe('HeaderService', () => {
  let service: HeaderService;
  let authApiServiceSpy: jasmine.SpyObj<AuthApiService>;
  let storageServiceSpy: jasmine.SpyObj<StorageService>;

  beforeEach(() => {
    // Create spy for AuthApiService
    authApiServiceSpy = jasmine.createSpyObj('AuthApiService', ['logout']);
    storageServiceSpy = jasmine.createSpyObj('StorageService', ['getSelectedLanguage', 'getSupportedLanguages']);
    storageServiceSpy.getSelectedLanguage.and.returnValue('en');
    storageServiceSpy.getSupportedLanguages.and.returnValue([]);

    TestBed.configureTestingModule({
      providers: [
        HeaderService,
        { provide: AuthApiService, useValue: authApiServiceSpy },
        { provide: StorageService, useValue: storageServiceSpy }
      ]
    });

    service = TestBed.inject(HeaderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('logout', () => {
    it('should call authApiService.logout when logout is called', (done) => {
      // Arrange
      authApiServiceSpy.logout.and.returnValue(of(undefined));

      // Act
      service.logout().subscribe({
        next: () => {
          // Assert
          expect(authApiServiceSpy.logout).toHaveBeenCalledTimes(1);
          done();
        }
      });
    });

    it('should complete successfully when logout API succeeds', (done) => {
      // Arrange
      authApiServiceSpy.logout.and.returnValue(of(undefined));

      // Act
      service.logout().subscribe({
        next: (result) => {
          // Assert
          expect(result).toBeUndefined();
          done();
        }
      });
    });

    it('should handle logout API errors gracefully and continue', (done) => {
      // Arrange
      const error = new Error('Logout failed');
      authApiServiceSpy.logout.and.returnValue(throwError(() => error));

      // Act
      service.logout().subscribe({
        next: (result) => {
          // Assert - should still complete even on error (silently handles errors)
          expect(result).toBeUndefined();
          done();
        }
      });
    });

    it('should not throw error when logout API fails', (done) => {
      // Arrange
      authApiServiceSpy.logout.and.returnValue(throwError(() => new Error('Network error')));

      // Act
      service.logout().subscribe({
        next: () => {
          // Assert - should reach here without error
          expect(true).toBe(true);
          done();
        },
        error: () => {
          // Should not reach here
          fail('Should not throw error');
        }
      });
    });
  });

  describe('language management', () => {
    it('should return empty languages initially', (done) => {
      service.getLanguages().subscribe(languages => {
        // Languages start empty and are populated from config/storage
        expect(languages.length).toBe(0);
        done();
      });
    });

    it('should set and get selected language', () => {
      service.setSelectedLanguage('es');
      expect(service.getSelectedLanguage()).toBe('es');
    });

    it('should update languages list', (done) => {
      const newLanguages = [
        { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' }
      ];

      service.setLanguages(newLanguages);

      service.getLanguages().subscribe(languages => {
        expect(languages.length).toBe(2);
        expect(languages[0].code).toBe('de');
        expect(languages[1].code).toBe('it');
        done();
      });
    });
  });
});

