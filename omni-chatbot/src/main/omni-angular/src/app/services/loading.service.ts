import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private isInitialLoadingSubject = new BehaviorSubject<boolean>(false);
  private isWebSocketLoadingSubject = new BehaviorSubject<boolean>(false);
  private isAuthLoadingSubject = new BehaviorSubject<boolean>(false);
  private isSessionLoadingSubject = new BehaviorSubject<boolean>(false);
  private isConfigLoadingSubject = new BehaviorSubject<boolean>(false);
  private isMessageHistoryLoadingSubject = new BehaviorSubject<boolean>(false);
  private loadingMessageSubject = new BehaviorSubject<string>('Loading...');

  // Observable streams
  public isLoading$ = this.isLoadingSubject.asObservable();
  public isInitialLoading$ = this.isInitialLoadingSubject.asObservable();
  public isWebSocketLoading$ = this.isWebSocketLoadingSubject.asObservable();
  public isAuthLoading$ = this.isAuthLoadingSubject.asObservable();
  public isSessionLoading$ = this.isSessionLoadingSubject.asObservable();
  public isConfigLoading$ = this.isConfigLoadingSubject.asObservable();
  public isMessageHistoryLoading$ = this.isMessageHistoryLoadingSubject.asObservable();
  public loadingMessage$ = this.loadingMessageSubject.asObservable();

  constructor() {}

  // General loading state
  setLoading(loading: boolean, message?: string): void {
    this.isLoadingSubject.next(loading);
    if (message) {
      this.loadingMessageSubject.next(message);
    }
  }

  // Initial app loading state
  setInitialLoading(loading: boolean, message?: string): void {
    this.isInitialLoadingSubject.next(loading);
    if (message) {
      this.loadingMessageSubject.next(message);
    }
  }

  // WebSocket response loading state
  setWebSocketLoading(loading: boolean, message?: string): void {
    this.isWebSocketLoadingSubject.next(loading);
    if (message) {
      this.loadingMessageSubject.next(message);
    }
  }

  // Authentication loading state
  setAuthLoading(loading: boolean, message?: string): void {
    this.isAuthLoadingSubject.next(loading);
    if (message) {
      this.loadingMessageSubject.next(message);
    }
    // Update initial loading state based on config, auth, and session loading
    this.updateInitialLoadingState();
  }

  // Session loading state
  setSessionLoading(loading: boolean, message?: string): void {
    this.isSessionLoadingSubject.next(loading);
    if (message) {
      this.loadingMessageSubject.next(message);
    }
    // Update initial loading state based on config, auth, and session loading
    this.updateInitialLoadingState();
  }

  // Config loading state
  setConfigLoading(loading: boolean, message?: string): void {
    this.isConfigLoadingSubject.next(loading);
    if (message) {
      this.loadingMessageSubject.next(message);
    }
    // Update initial loading state based on config, auth, and session loading
    this.updateInitialLoadingState();
  }

  // Message history loading state
  setMessageHistoryLoading(loading: boolean, message?: string): void {
    this.isMessageHistoryLoadingSubject.next(loading);
    if (message) {
      this.loadingMessageSubject.next(message);
    }
  }

  // Get current loading states
  get isLoading(): boolean {
    return this.isLoadingSubject.value;
  }

  get isInitialLoading(): boolean {
    return this.isInitialLoadingSubject.value;
  }

  get isWebSocketLoading(): boolean {
    return this.isWebSocketLoadingSubject.value;
  }

  get isAuthLoading(): boolean {
    return this.isAuthLoadingSubject.value;
  }

  get isSessionLoading(): boolean {
    return this.isSessionLoadingSubject.value;
  }

  get isConfigLoading(): boolean {
    return this.isConfigLoadingSubject.value;
  }

  get isMessageHistoryLoading(): boolean {
    return this.isMessageHistoryLoadingSubject.value;
  }

  get loadingMessage(): string {
    return this.loadingMessageSubject.value;
  }

  // Check if any loading is active
  get isAnyLoading(): boolean {
    return this.isLoading || this.isInitialLoading || this.isWebSocketLoading ||
           this.isAuthLoading || this.isSessionLoading || this.isConfigLoading ||
           this.isMessageHistoryLoading;
  }

  // Private method to update initial loading state based on config, auth, and session loading
  private updateInitialLoadingState(): void {
    const isInitiallyLoading = this.isConfigLoading || this.isAuthLoading || this.isSessionLoading;
    this.isInitialLoadingSubject.next(isInitiallyLoading);
  }
}
