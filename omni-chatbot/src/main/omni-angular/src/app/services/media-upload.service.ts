import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { StorageService } from './storage.service';
import * as CryptoJS from 'crypto-js';

export interface UploadMediaResponse {
  mediaId: string;
  file: File;
}

/**
 * Service for uploading media files to the server
 * Matches the original app's uploadMediaRequest implementation
 */
@Injectable({
  providedIn: 'root'
})
export class MediaUploadService {

  constructor(
    private http: HttpClient,
    private storageService: StorageService
  ) {}

  /**
   * Upload a file to the media server
   * @param workspaceId - The workspace ID
   * @param file - The file to upload
   * @param scope - The scope (e.g., 'messages')
   * @returns Observable with mediaId and original file
   */
  uploadMedia(workspaceId: string, file: File, scope: string = 'messages'): Observable<UploadMediaResponse> {
    // First calculate MD5 checksum
    return from(this.calculateMD5(file)).pipe(
      switchMap(md5Checksum => {
        // Create FormData
        const formData = new FormData();
        formData.append('file', file);
        formData.append('scope', scope);
        formData.append('checksum', md5Checksum);

        // Upload to server
        const url = `/media/workspaces/${workspaceId}`;

        // Get authentication headers (matches original app)
        const headers = this.getAuthenticatedHeaders();

        // Note: Don't set Content-Type header for FormData
        // The browser will automatically set it to multipart/form-data with the correct boundary
        // The AuthInterceptor will skip setting Content-Type for FormData requests

        // Use responseType: 'text' because the server returns a plain string (mediaId), not JSON
        return this.http.put(url, formData, { headers, responseType: 'text' }).pipe(
          map(mediaId => {
            return {
              mediaId,
              file
            };
          })
        );
      })
    );
  }

  /**
   * Get authenticated headers matching original app patterns
   * Matches ApiService.getAuthenticatedHeaders() but without Content-Type for FormData
   */
  private getAuthenticatedHeaders(): HttpHeaders {
    let headers = new HttpHeaders();

    // Add Chatbot-Session-Id + X-Krista-Context headers from the stored
    // clientSessionId. The X-Krista-Context envelope is the URI-encoded
    // JSON {clientSessionId: <id>} the server expects.
    const sessionId = this.storageService.getClientSessionId();
    if (sessionId) {
      headers = headers.set('Chatbot-Session-Id', sessionId);
      headers = headers.set('X-Krista-Context',
          encodeURIComponent(JSON.stringify({ clientSessionId: sessionId })));
    }

    return headers;
  }

  /**
   * Calculate MD5 checksum of a file using CryptoJS
   * Matches original app implementation exactly
   * @param file - The file to calculate checksum for
   * @returns Promise with MD5 checksum string
   */
  private calculateMD5(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          // Convert ArrayBuffer to WordArray using CryptoJS (matches original app)
          const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer as any);
          // Calculate MD5 checksum
          const md5Checksum = CryptoJS.MD5(wordArray).toString(CryptoJS.enc.Hex);
          resolve(md5Checksum);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = error => {
        reject(error);
      };

      reader.readAsArrayBuffer(file);
    });
  }
}

