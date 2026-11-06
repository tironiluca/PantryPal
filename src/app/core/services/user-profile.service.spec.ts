import { UserProfileService } from './user-profile.service';

function chainable(result: { data?: any; error?: any } = { data: null, error: null }) {
  const obj: any = {
    select: vi.fn(() => obj),
    eq: vi.fn(() => obj),
    update: vi.fn(() => obj),
    delete: vi.fn(() => obj),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  };
  return obj;
}

function makeStorage({
  uploadError = null as any,
  publicUrl = 'https://cdn.example.com/avatars/file.png',
  removeError = null as any,
}: { uploadError?: any; publicUrl?: string; removeError?: any } = {}) {
  return {
    from: vi.fn(() => ({
      upload: vi.fn(async () => ({ error: uploadError })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl } })),
      remove: vi.fn(async () => ({ error: removeError })),
    })),
  };
}

function bare(): UserProfileService & Record<string, any> {
  const service = Object.create(UserProfileService.prototype) as UserProfileService & Record<string, any>;
  service.snackbar = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  service.errorHandler = { handle: vi.fn() };
  return service;
}

function fakeFile(overrides: Partial<{ type: string; size: number; name: string }> = {}): File {
  return {
    type: overrides.type ?? 'image/png',
    size: overrides.size ?? 1024,
    name: overrides.name ?? 'avatar.png',
  } as unknown as File;
}

describe('UserProfileService', () => {
  describe('getProfile', () => {
    it('returns null without querying when there is no user id', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };
      service.supabase = { from: vi.fn() };

      await expect(service.getProfile()).resolves.toBeNull();
      expect(service.supabase.from).not.toHaveBeenCalled();
    });

    it('maps the stored row onto a UserProfile', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.supabase = {
        from: vi.fn(() =>
          chainable({
            data: {
              id: 'u1',
              email: 'a@b.com',
              display_name: 'Ada',
              avatar_url: 'https://cdn/x.png',
              preferences: { theme: 'dark' },
              created_at: '2026-01-01',
              last_sync_at: '2026-02-01',
            },
          })
        ),
      };

      await expect(service.getProfile()).resolves.toEqual({
        id: 'u1',
        email: 'a@b.com',
        displayName: 'Ada',
        avatarUrl: 'https://cdn/x.png',
        preferences: { theme: 'dark' },
        createdAt: '2026-01-01',
        lastSyncAt: '2026-02-01',
      });
    });

    it('returns null when no row is found', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.supabase = { from: vi.fn(() => chainable({ data: null })) };

      await expect(service.getProfile()).resolves.toBeNull();
    });

    it('reports and swallows a query error', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const error = new Error('db down');
      service.supabase = { from: vi.fn(() => chainable({ error })) };

      await expect(service.getProfile()).resolves.toBeNull();
      expect(service.errorHandler.handle).toHaveBeenCalledWith(error, 'Failed to load profile');
    });

    it('uses an explicitly provided user id over the current session', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'session-user' };
      const chain = chainable({ data: { id: 'other-user' } });
      service.supabase = { from: vi.fn(() => chain) };

      await service.getProfile('other-user');

      expect(chain.eq).toHaveBeenCalledWith('id', 'other-user');
    });
  });

  describe('updateProfile', () => {
    it('fails when not authenticated', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };

      await expect(service.updateProfile({ displayName: 'Ada' })).resolves.toBe(false);
      expect(service.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to update profile'
      );
    });

    it('sends only the provided fields and reports success', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const users = chainable({ error: null });
      service.supabase = { from: vi.fn(() => users) };

      const ok = await service.updateProfile({ displayName: 'Ada' });

      expect(ok).toBe(true);
      expect(users.update).toHaveBeenCalledWith(
        expect.objectContaining({ display_name: 'Ada' })
      );
      expect(users.update.mock.calls[0][0]).not.toHaveProperty('avatar_url');
      expect(users.update.mock.calls[0][0]).not.toHaveProperty('preferences');
      expect(service.snackbar.success).toHaveBeenCalledWith('Profile updated successfully');
    });

    it('reports failure when the update errors', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const error = new Error('conflict');
      service.supabase = { from: vi.fn(() => chainable({ error })) };

      await expect(service.updateProfile({ displayName: 'Ada' })).resolves.toBe(false);
      expect(service.errorHandler.handle).toHaveBeenCalledWith(error, 'Failed to update profile');
    });
  });

  describe('uploadAvatar', () => {
    it('fails when not authenticated', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };

      await expect(service.uploadAvatar(fakeFile())).resolves.toBeNull();
    });

    it('rejects a non-image file', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.supabase = { storage: makeStorage() };

      await expect(service.uploadAvatar(fakeFile({ type: 'text/plain' }))).resolves.toBeNull();
      expect(service.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(Error),
        'Failed to upload avatar'
      );
    });

    it('rejects a file larger than 2MB', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.supabase = { storage: makeStorage() };

      await expect(
        service.uploadAvatar(fakeFile({ size: 3 * 1024 * 1024 }))
      ).resolves.toBeNull();
    });

    it('returns null when the storage upload fails', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.supabase = { storage: makeStorage({ uploadError: new Error('quota exceeded') }) };

      await expect(service.uploadAvatar(fakeFile())).resolves.toBeNull();
    });

    it('uploads the file and updates the profile with the public URL', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.supabase = { storage: makeStorage({ publicUrl: 'https://cdn/avatars/u1.png' }) };
      service.updateProfile = vi.fn(async () => true);

      const url = await service.uploadAvatar(fakeFile());

      expect(url).toBe('https://cdn/avatars/u1.png');
      expect(service.updateProfile).toHaveBeenCalledWith({ avatarUrl: 'https://cdn/avatars/u1.png' });
    });
  });

  describe('deleteAvatar', () => {
    it('fails when not authenticated', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };

      await expect(service.deleteAvatar()).resolves.toBe(false);
    });

    it('returns true without touching storage when there is no avatar', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.getProfile = vi.fn(async () => ({ avatarUrl: undefined }));
      service.supabase = { storage: makeStorage() };

      await expect(service.deleteAvatar()).resolves.toBe(true);
      expect(service.supabase.storage.from).not.toHaveBeenCalled();
    });

    it('removes the stored file and clears the avatar URL', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.getProfile = vi.fn(async () => ({
        avatarUrl: 'https://cdn.example.com/storage/v1/object/public/avatars/u1-123.png',
      }));
      const storage = makeStorage();
      service.supabase = { storage };
      service.updateProfile = vi.fn(async () => true);

      await expect(service.deleteAvatar()).resolves.toBe(true);
      expect(service.updateProfile).toHaveBeenCalledWith({ avatarUrl: undefined });
      expect(service.snackbar.success).toHaveBeenCalledWith('Avatar removed');
    });

    it('tolerates a "not found" removal error', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.getProfile = vi.fn(async () => ({ avatarUrl: 'https://cdn.example.com/avatars/gone.png' }));
      service.supabase = { storage: makeStorage({ removeError: { message: 'not found' } }) };
      service.updateProfile = vi.fn(async () => true);

      await expect(service.deleteAvatar()).resolves.toBe(true);
    });

    it('fails on a non-"not found" removal error', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.getProfile = vi.fn(async () => ({ avatarUrl: 'https://cdn.example.com/avatars/x.png' }));
      service.supabase = { storage: makeStorage({ removeError: { message: 'forbidden' } }) };
      service.updateProfile = vi.fn(async () => true);

      await expect(service.deleteAvatar()).resolves.toBe(false);
      expect(service.updateProfile).not.toHaveBeenCalled();
    });
  });

  describe('updateLastSync', () => {
    it('does nothing when not authenticated', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };
      service.supabase = { from: vi.fn() };

      await service.updateLastSync();

      expect(service.supabase.from).not.toHaveBeenCalled();
    });

    it('swallows errors instead of throwing', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.supabase = {
        from: vi.fn(() => {
          throw new Error('offline');
        }),
      };

      await expect(service.updateLastSync()).resolves.toBeUndefined();
    });

    it('updates the last sync timestamp when authenticated', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const users = chainable({ error: null });
      service.supabase = { from: vi.fn(() => users) };

      await service.updateLastSync();

      expect(users.update).toHaveBeenCalledWith(
        expect.objectContaining({ last_sync_at: expect.any(String) })
      );
    });
  });

  describe('deleteAccount', () => {
    it('fails when not authenticated', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };

      await expect(service.deleteAccount()).resolves.toBe(false);
    });

    it('deletes the row, signs out, and reports success', async () => {
      const service = bare();
      const signOut = vi.fn(async () => {});
      service.auth = { getCurrentUserId: () => 'u1', signOut };
      service.supabase = { from: vi.fn(() => chainable({ error: null })) };

      await expect(service.deleteAccount()).resolves.toBe(true);
      expect(signOut).toHaveBeenCalled();
      expect(service.snackbar.success).toHaveBeenCalledWith('Account deleted successfully');
    });

    it('fails and does not sign out when the delete errors', async () => {
      const service = bare();
      const signOut = vi.fn(async () => {});
      service.auth = { getCurrentUserId: () => 'u1', signOut };
      service.supabase = { from: vi.fn(() => chainable({ error: new Error('locked') })) };

      await expect(service.deleteAccount()).resolves.toBe(false);
      expect(signOut).not.toHaveBeenCalled();
    });
  });

  describe('preferences', () => {
    it('falls back to an empty object when there is no profile', async () => {
      const service = bare();
      service.getProfile = vi.fn(async () => null);

      await expect(service.getPreferences()).resolves.toEqual({});
    });

    it('returns the stored preferences', async () => {
      const service = bare();
      service.getProfile = vi.fn(async () => ({ preferences: { theme: 'dark' } }));

      await expect(service.getPreferences()).resolves.toEqual({ theme: 'dark' });
    });

    it('delegates updatePreferences to updateProfile', async () => {
      const service = bare();
      service.updateProfile = vi.fn(async () => true);

      await expect(service.updatePreferences({ theme: 'dark' })).resolves.toBe(true);
      expect(service.updateProfile).toHaveBeenCalledWith({ preferences: { theme: 'dark' } });
    });
  });
});
