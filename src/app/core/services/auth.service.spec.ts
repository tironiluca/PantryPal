import { signal } from '@angular/core';
import { AuthService } from './auth.service';

function bare(): AuthService & Record<string, any> {
  const service = Object.create(AuthService.prototype) as AuthService & Record<string, any>;
  service.currentUserSignal = signal(null);
  service.currentSessionSignal = signal(null);
  service.loadingSignal = signal(true);
  service.initialized = false;
  service.snackbar = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  service.errorHandler = { handle: vi.fn() };
  service.router = { navigate: vi.fn(async () => true) };
  return service;
}

function chainable(result: { data?: any; error?: any } = { data: null, error: null }) {
  const obj: any = {
    select: vi.fn(() => obj),
    eq: vi.fn(() => obj),
    insert: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
  };
  return obj;
}

describe('AuthService', () => {
  describe('getCurrentUserId / getCurrentUserEmail', () => {
    it('returns null without a signed-in user', () => {
      const service = bare();
      expect(service.getCurrentUserId()).toBeNull();
      expect(service.getCurrentUserEmail()).toBeNull();
    });

    it('returns the current user id and email', () => {
      const service = bare();
      service.currentUserSignal.set({ id: 'u1', email: 'a@b.com' });
      expect(service.getCurrentUserId()).toBe('u1');
      expect(service.getCurrentUserEmail()).toBe('a@b.com');
    });
  });

  describe('signUp', () => {
    it('creates the profile and reports success when a user is returned', async () => {
      const service = bare();
      service.supabase = {
        auth: { signUp: vi.fn(async () => ({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null })) },
      };
      service.createUserProfile = vi.fn(async () => {});

      const result = await service.signUp('a@b.com', 'password1', 'Ada');

      expect(service.createUserProfile).toHaveBeenCalledWith({ id: 'u1', email: 'a@b.com' }, 'Ada');
      expect(service.snackbar.success).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('reports a mapped error message when sign-up fails', async () => {
      const service = bare();
      service.supabase = {
        auth: {
          signUp: vi.fn(async () => {
            throw { message: 'User already registered' };
          }),
        },
      };

      const result = await service.signUp('a@b.com', 'password1');

      expect(result).toEqual({ success: false, error: 'An account with this email already exists' });
      expect(service.snackbar.error).toHaveBeenCalledWith('An account with this email already exists');
    });

    it('reports a generic failure when no user is returned', async () => {
      const service = bare();
      service.supabase = { auth: { signUp: vi.fn(async () => ({ data: { user: null }, error: null })) } };

      const result = await service.signUp('a@b.com', 'password1');

      expect(result).toEqual({ success: false, error: 'Failed to create account' });
    });
  });

  describe('signIn', () => {
    it('ensures the profile exists and reports success', async () => {
      const service = bare();
      const user = { id: 'u1', email: 'a@b.com' };
      service.supabase = {
        auth: {
          signInWithPassword: vi.fn(async () => ({ data: { session: {}, user }, error: null })),
        },
      };
      service.ensureUserProfile = vi.fn(async () => {});

      const result = await service.signIn('a@b.com', 'password1');

      expect(service.ensureUserProfile).toHaveBeenCalledWith(user);
      expect(result).toEqual({ success: true });
    });

    it('maps invalid credentials to a friendly message', async () => {
      const service = bare();
      service.supabase = {
        auth: {
          signInWithPassword: vi.fn(async () => {
            throw { message: 'Invalid login credentials' };
          }),
        },
      };

      const result = await service.signIn('a@b.com', 'wrong');

      expect(result).toEqual({ success: false, error: 'Invalid email or password' });
    });

    it('reports a generic failure when no session is returned', async () => {
      const service = bare();
      service.supabase = {
        auth: { signInWithPassword: vi.fn(async () => ({ data: { session: null, user: null }, error: null })) },
      };

      const result = await service.signIn('a@b.com', 'password1');

      expect(result).toEqual({ success: false, error: 'Failed to sign in' });
    });
  });

  describe('signInWithOAuth', () => {
    it('does not notify on success', async () => {
      const service = bare();
      service.supabase = { auth: { signInWithOAuth: vi.fn(async () => ({ error: null })) } };

      await service.signInWithOAuth('google');

      expect(service.snackbar.error).not.toHaveBeenCalled();
    });

    it('reports a mapped error on failure', async () => {
      const service = bare();
      service.supabase = {
        auth: { signInWithOAuth: vi.fn(async () => ({ error: { message: 'provider down' } })) },
      };

      await service.signInWithOAuth('github');

      expect(service.snackbar.error).toHaveBeenCalledWith('provider down');
    });
  });

  describe('signOut', () => {
    it('clears the session on success', async () => {
      const service = bare();
      service.currentUserSignal.set({ id: 'u1' });
      service.currentSessionSignal.set({});
      service.supabase = { auth: { signOut: vi.fn(async () => ({ error: null })) } };

      await service.signOut();

      expect(service.currentUserSignal()).toBeNull();
      expect(service.currentSessionSignal()).toBeNull();
    });

    it('reports the failure and keeps the session when sign-out errors', async () => {
      const service = bare();
      service.currentUserSignal.set({ id: 'u1' });
      const error = new Error('network down');
      service.supabase = { auth: { signOut: vi.fn(async () => { throw error; }) } };

      await service.signOut();

      expect(service.errorHandler.handle).toHaveBeenCalledWith(error, 'Failed to sign out');
      expect(service.currentUserSignal()).toEqual({ id: 'u1' });
    });
  });

  describe('resetPassword', () => {
    it('reports success and notifies the user', async () => {
      const service = bare();
      service.supabase = { auth: { resetPasswordForEmail: vi.fn(async () => ({ error: null })) } };

      await expect(service.resetPassword('a@b.com')).resolves.toEqual({ success: true });
      expect(service.snackbar.success).toHaveBeenCalled();
    });

    it('reports a mapped error on failure', async () => {
      const service = bare();
      service.supabase = {
        auth: {
          resetPasswordForEmail: vi.fn(async () => {
            throw { message: 'rate limited' };
          }),
        },
      };

      await expect(service.resetPassword('a@b.com')).resolves.toEqual({
        success: false,
        error: 'rate limited',
      });
    });
  });

  describe('updatePassword', () => {
    it('reports success', async () => {
      const service = bare();
      service.supabase = { auth: { updateUser: vi.fn(async () => ({ error: null })) } };

      await expect(service.updatePassword('newpass')).resolves.toEqual({ success: true });
    });

    it('maps the weak-password error', async () => {
      const service = bare();
      service.supabase = {
        auth: {
          updateUser: vi.fn(async () => {
            throw { message: 'Password should be at least 6 characters' };
          }),
        },
      };

      await expect(service.updatePassword('a')).resolves.toEqual({
        success: false,
        error: 'Password must be at least 6 characters long',
      });
    });
  });

  describe('getAuthErrorMessage', () => {
    it('returns a plain string error as-is', () => {
      const service = bare();
      expect(service.getAuthErrorMessage('boom')).toBe('boom');
    });

    it('falls back to the raw message for unmapped errors', () => {
      const service = bare();
      expect(service.getAuthErrorMessage({ message: 'something unexpected' })).toBe('something unexpected');
    });

    it('falls back to a generic message when there is no message at all', () => {
      const service = bare();
      expect(service.getAuthErrorMessage({})).toBe('An authentication error occurred');
    });
  });

  describe('ensureUserProfile', () => {
    it('creates a profile when none exists yet', async () => {
      const service = bare();
      service.supabase = { from: vi.fn(() => chainable({ data: null })) };
      service.createUserProfile = vi.fn(async () => {});

      await service.ensureUserProfile({ id: 'u1' });

      expect(service.createUserProfile).toHaveBeenCalledWith({ id: 'u1' });
    });

    it('does nothing when a profile already exists', async () => {
      const service = bare();
      service.supabase = { from: vi.fn(() => chainable({ data: { id: 'u1' } })) };
      service.createUserProfile = vi.fn(async () => {});

      await service.ensureUserProfile({ id: 'u1' });

      expect(service.createUserProfile).not.toHaveBeenCalled();
    });

    it('swallows a lookup failure instead of throwing', async () => {
      const service = bare();
      service.supabase = {
        from: vi.fn(() => {
          throw new Error('offline');
        }),
      };

      await expect(service.ensureUserProfile({ id: 'u1' })).resolves.toBeUndefined();
    });
  });

  describe('createUserProfile', () => {
    it('ignores a duplicate-key insert error', async () => {
      const service = bare();
      service.supabase = { from: vi.fn(() => chainable({ error: { message: 'duplicate key value' } })) };

      await expect(
        service.createUserProfile({ id: 'u1', email: 'a@b.com' })
      ).resolves.toBeUndefined();
    });

    it('swallows a non-duplicate insert error without rethrowing', async () => {
      const service = bare();
      service.supabase = { from: vi.fn(() => chainable({ error: { message: 'permission denied' } })) };

      await expect(
        service.createUserProfile({ id: 'u1', email: 'a@b.com' })
      ).resolves.toBeUndefined();
    });

    it('defaults the display name to the email prefix', async () => {
      const service = bare();
      const insertedRow = chainable({ error: null });
      service.supabase = { from: vi.fn(() => insertedRow) };

      await service.createUserProfile({ id: 'u1', email: 'ada@example.com' });

      expect(insertedRow.insert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1', email: 'ada@example.com', display_name: 'ada' })
      );
    });
  });

  describe('initializeAuthState', () => {
    function withSupabase(session: any, getSessionError: any = null) {
      let authChangeCallback: ((event: string, session: any) => void) | undefined;
      const supabase = {
        auth: {
          getSession: vi.fn(async () => {
            if (getSessionError) throw getSessionError;
            return { data: { session }, error: null };
          }),
          onAuthStateChange: vi.fn((cb: any) => {
            authChangeCallback = cb;
          }),
        },
      };
      return { supabase, getCallback: () => authChangeCallback! };
    }

    it('restores an existing session and stops loading', async () => {
      const service = bare();
      const { supabase } = withSupabase({ user: { id: 'u1' } });
      service.supabase = supabase;

      await service.initializeAuthState();

      expect(service.currentSessionSignal()).toEqual({ user: { id: 'u1' } });
      expect(service.currentUserSignal()).toEqual({ id: 'u1' });
      expect(service.loadingSignal()).toBe(false);
      expect(service.initialized).toBe(true);
    });

    it('leaves signals unset when there is no stored session', async () => {
      const service = bare();
      const { supabase } = withSupabase(null);
      service.supabase = supabase;

      await service.initializeAuthState();

      expect(service.currentUserSignal()).toBeNull();
      expect(service.loadingSignal()).toBe(false);
    });

    it('reports and recovers from a getSession failure', async () => {
      const service = bare();
      const { supabase } = withSupabase(null, new Error('network down'));
      service.supabase = supabase;

      await service.initializeAuthState();

      expect(service.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to initialize authentication'
      );
      expect(service.loadingSignal()).toBe(false);
      expect(service.initialized).toBe(true);
    });

    it('ignores auth state events fired before initialization completes', async () => {
      const service = bare();
      const { supabase, getCallback } = withSupabase(null);
      service.supabase = supabase;
      await service.initializeAuthState();

      service.initialized = false;
      getCallback()('SIGNED_OUT', null);

      expect(service.router.navigate).not.toHaveBeenCalled();
      expect(service.snackbar.info).not.toHaveBeenCalled();
    });

    it('navigates to login on a post-init sign-out event', async () => {
      const service = bare();
      const { supabase, getCallback } = withSupabase(null);
      service.supabase = supabase;
      await service.initializeAuthState();

      getCallback()('SIGNED_OUT', null);
      await Promise.resolve();

      expect(service.snackbar.info).toHaveBeenCalledWith('Signed out');
      expect(service.router.navigate).toHaveBeenCalledWith(['/auth/login']);
    });

    it('notifies without navigating on a post-init sign-in event', async () => {
      const service = bare();
      const { supabase, getCallback } = withSupabase(null);
      service.supabase = supabase;
      await service.initializeAuthState();

      getCallback()('SIGNED_IN', { user: { id: 'u1' } });

      expect(service.snackbar.success).toHaveBeenCalledWith('Signed in successfully');
      expect(service.router.navigate).not.toHaveBeenCalled();
    });

    it('notifies on a post-init profile update event', async () => {
      const service = bare();
      const { supabase, getCallback } = withSupabase(null);
      service.supabase = supabase;
      await service.initializeAuthState();

      getCallback()('USER_UPDATED', { user: { id: 'u1' } });

      expect(service.snackbar.info).toHaveBeenCalledWith('Profile updated');
    });
  });
});
