import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface User {
  id: string;
  name: string;
  email?: string;
  isAuthenticated: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private userSubject = new BehaviorSubject<User>({
    id: 'guest-user',
    name: 'Guest User',
    isAuthenticated: false
  });

  public user$ = this.userSubject.asObservable();

  constructor() {}

  initializeUser(): void {
    // Initialize with guest user
  }

  getCurrentUser(): User {
    return this.userSubject.value;
  }

  updateUser(user: Partial<User>): void {
    const currentUser = this.userSubject.value;
    this.userSubject.next({ ...currentUser, ...user });
  }

  setAuthenticated(isAuthenticated: boolean): void {
    this.updateUser({ isAuthenticated });
  }
}
