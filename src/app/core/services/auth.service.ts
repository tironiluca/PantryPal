import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { createClient, SupabaseClient, User, Session, AuthError } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { SnackbarService } from './snackbar.service';
import { ErrorHandlerService } from './error-handler.service';

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  preferences?: any;
  createdAt?: string;
  lastSyncAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
  private snackbar = inject(SnackbarService);
  private errorHandler = inject(ErrorHandlerService);

  private supabase: SupabaseClient;
  private initialized = false;

  // Reactive state using signals
  private currentUserSignal = signal<User | null>(null);
  private currentSessionSignal = signal<Session | null>(null);
  private loadingSignal = signal<boolean>(true);

  // Public computed signals
  currentUser = this.currentUserSignal.asReadonly();
  currentSession = this.currentSessionSignal.asReadonly();
  loading = this.loadingSignal.asReadonly();
  isAuthenticated = computed(() => this.currentUserSignal() !== null);

  constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.anonKey,
      {
        auth: {
          persistSession: true,
          storage: localStorage,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );

    // Initialize auth state
    this.initializeAuthState();
  }

  /**
   * Initialize authentication state from stored session
   */
  private async initializeAuthState(): Promise<void> {
    try {
      // Get current session
      const { data: { session }, error } = await this.supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (session) {
        this.currentSessionSignal.set(session);
        this.currentUserSignal.set(session.user);
      }

      // Listen for auth state changes
      this.supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);

        this.currentSessionSignal.set(session);
        this.currentUserSignal.set(session?.user ?? null);

        // Skip navigation during initial session restoration — let guards handle it
        if (!this.initialized) {
          return;
        }

        // Handle auth events only after initialization
        switch (event) {
          case 'SIGNED_IN':
            this.snackbar.success('Signed in successfully');
            // Navigation is handled by the calling component (LoginComponent, OAuth redirect)
            break;
          case 'SIGNED_OUT':
            this.snackbar.info('Signed out');
            await this.router.navigate(['/auth/login']);
            break;
          case 'TOKEN_REFRESHED':
            console.log('Token refreshed');
            break;
          case 'USER_UPDATED':
            this.snackbar.info('Profile updated');
            break;
        }
      });
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to initialize authentication');
    } finally {
      this.loadingSignal.set(false);
      this.initialized = true;
    }
  }

  /**
   * Sign up a new user with email and password
   */
  async signUp(email: string, password: string, displayName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        // Create user profile in public.users table
        await this.createUserProfile(data.user, displayName);

        this.snackbar.success('Account created! Please check your email to verify.');
        return { success: true };
      }

      return { success: false, error: 'Failed to create account' };
    } catch (error) {
      const message = this.getAuthErrorMessage(error);
      this.snackbar.error(message);
      return { success: false, error: message };
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.session && data.user) {
        // Ensure user profile exists (may be missing if created before profile table)
        await this.ensureUserProfile(data.user);
        return { success: true };
      }

      return { success: false, error: 'Failed to sign in' };
    } catch (error) {
      const message = this.getAuthErrorMessage(error);
      this.snackbar.error(message);
      return { success: false, error: message };
    }
  }

  /**
   * Sign in with OAuth provider (Google, GitHub, etc.)
   */
  async signInWithOAuth(provider: 'google' | 'github' | 'facebook'): Promise<void> {
    try {
      const { error } = await this.supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/home`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      const message = this.getAuthErrorMessage(error);
      this.snackbar.error(message);
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        throw error;
      }

      this.currentUserSignal.set(null);
      this.currentSessionSignal.set(null);
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to sign out');
    }
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        throw error;
      }

      this.snackbar.success('Password reset email sent. Please check your inbox.');
      return { success: true };
    } catch (error) {
      const message = this.getAuthErrorMessage(error);
      this.snackbar.error(message);
      return { success: false, error: message };
    }
  }

  /**
   * Update password (called from reset password page)
   */
  async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      this.snackbar.success('Password updated successfully');
      return { success: true };
    } catch (error) {
      const message = this.getAuthErrorMessage(error);
      this.snackbar.error(message);
      return { success: false, error: message };
    }
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.currentUserSignal()?.id ?? null;
  }

  /**
   * Get current user email
   */
  getCurrentUserEmail(): string | null {
    return this.currentUserSignal()?.email ?? null;
  }

  /**
   * Get Supabase client (for direct use in other services)
   */
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Ensure user profile exists in public.users table (creates if missing)
   */
  private async ensureUserProfile(user: User): Promise<void> {
    try {
      const { data } = await this.supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!data) {
        await this.createUserProfile(user);
      }
    } catch (error) {
      console.error('Failed to ensure user profile:', error);
    }
  }

  /**
   * Create user profile in public.users table
   */
  private async createUserProfile(user: User, displayName?: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email!,
          display_name: displayName || user.email?.split('@')[0],
          preferences: {},
          created_at: new Date().toISOString(),
        });

      if (error) {
        // Ignore duplicate key errors (user already exists)
        if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
          throw error;
        }
      }
    } catch (error) {
      console.error('Failed to create user profile:', error);
      // Don't throw - this is not critical for auth flow
    }
  }

  /**
   * Get user-friendly error message from auth error
   */
  private getAuthErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }

    const authError = error as AuthError;

    // Common Supabase auth error messages
    switch (authError.message) {
      case 'Invalid login credentials':
        return 'Invalid email or password';
      case 'Email not confirmed':
        return 'Please verify your email address before signing in';
      case 'User already registered':
        return 'An account with this email already exists';
      case 'Password should be at least 6 characters':
        return 'Password must be at least 6 characters long';
      default:
        return authError.message || 'An authentication error occurred';
    }
  }
}
