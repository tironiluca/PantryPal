import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ProfileComponent } from './profile.component';

function bare(): ProfileComponent & Record<string, any> {
  const component = Object.create(ProfileComponent.prototype) as ProfileComponent & Record<string, any>;
  component.profile = signal(null);
  component.loading = signal(true);
  component.saving = signal(false);
  component.displayName = '';
  component.email = '';
  component.avatarUrl = '';
  component.auth = { signOut: vi.fn().mockResolvedValue(undefined) };
  component.profileService = {
    getProfile: vi.fn().mockResolvedValue({ id: 'u1', email: 'jamie@example.com', displayName: 'Jamie Lee', avatarUrl: 'a.png' }),
    updateProfile: vi.fn().mockResolvedValue(true),
    uploadAvatar: vi.fn().mockResolvedValue('new.png'),
    deleteAvatar: vi.fn().mockResolvedValue(true),
    deleteAccount: vi.fn().mockResolvedValue(true),
  };
  component.router = { navigate: vi.fn().mockResolvedValue(true) };
  component.snackbar = { error: vi.fn() };
  component.transloco = { translate: (key: string) => key };
  component.dialog = { open: vi.fn(() => ({ afterClosed: () => of(true) })) };
  return component;
}

function fileEvent(files: File[]): Event {
  return { target: { files } } as unknown as Event;
}

describe('ProfileComponent', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('loadProfile', () => {
    it('populates the editable fields and clears loading', async () => {
      const component = bare();

      await component.ngOnInit();

      expect(component.profile()).toEqual(expect.objectContaining({ email: 'jamie@example.com' }));
      expect(component.displayName).toBe('Jamie Lee');
      expect(component.email).toBe('jamie@example.com');
      expect(component.avatarUrl).toBe('a.png');
      expect(component.loading()).toBe(false);
    });

    it('defaults missing optional fields to empty strings', async () => {
      const component = bare();
      component.profileService.getProfile.mockResolvedValue({ id: 'u1', email: 'x@y.com' });

      await component.loadProfile();

      expect(component.displayName).toBe('');
      expect(component.avatarUrl).toBe('');
    });

    it('leaves fields untouched when there is no profile', async () => {
      const component = bare();
      component.profileService.getProfile.mockResolvedValue(null);

      await component.loadProfile();

      expect(component.profile()).toBeNull();
      expect(component.loading()).toBe(false);
    });

    it('clears loading even if the lookup throws', async () => {
      const component = bare();
      component.profileService.getProfile.mockRejectedValue(new Error('offline'));

      await expect(component.loadProfile()).rejects.toThrow('offline');
      expect(component.loading()).toBe(false);
    });
  });

  describe('onSubmit', () => {
    it('saves the display name and reloads on success', async () => {
      const component = bare();
      component.displayName = 'New Name';

      await component.onSubmit();

      expect(component.profileService.updateProfile).toHaveBeenCalledWith({ displayName: 'New Name' });
      expect(component.profileService.getProfile).toHaveBeenCalled();
      expect(component.saving()).toBe(false);
    });

    it('does not reload when the update fails', async () => {
      const component = bare();
      component.profileService.updateProfile.mockResolvedValue(false);

      await component.onSubmit();

      expect(component.profileService.getProfile).not.toHaveBeenCalled();
      expect(component.saving()).toBe(false);
    });
  });

  describe('onAvatarFileSelected', () => {
    it('ignores an empty selection', async () => {
      const component = bare();
      await component.onAvatarFileSelected(fileEvent([]));
      expect(component.profileService.uploadAvatar).not.toHaveBeenCalled();
    });

    it('uploads the chosen file and applies the new url', async () => {
      const component = bare();
      component.profileService.getProfile.mockResolvedValue(null);
      const file = new File(['x'], 'me.png');

      await component.onAvatarFileSelected(fileEvent([file]));

      expect(component.profileService.uploadAvatar).toHaveBeenCalledWith(file);
      expect(component.avatarUrl).toBe('new.png');
      expect(component.saving()).toBe(false);
    });

    it('keeps the old avatar when the upload returns nothing', async () => {
      const component = bare();
      component.avatarUrl = 'old.png';
      component.profileService.uploadAvatar.mockResolvedValue(null);

      await component.onAvatarFileSelected(fileEvent([new File(['x'], 'me.png')]));

      expect(component.avatarUrl).toBe('old.png');
    });
  });

  describe('removeAvatar', () => {
    it('does nothing when the confirmation is declined', async () => {
      const component = bare();
      component.dialog.open.mockReturnValue({ afterClosed: () => of(false) });

      await component.removeAvatar();

      expect(component.profileService.deleteAvatar).not.toHaveBeenCalled();
    });

    it('deletes the avatar and clears the url once confirmed', async () => {
      const component = bare();
      component.avatarUrl = 'a.png';
      component.profileService.getProfile.mockResolvedValue(null);

      await component.removeAvatar();

      expect(component.profileService.deleteAvatar).toHaveBeenCalled();
      expect(component.avatarUrl).toBe('');
      expect(component.saving()).toBe(false);
    });
  });

  describe('signOut', () => {
    it('delegates to the auth service', async () => {
      const component = bare();
      await component.signOut();
      expect(component.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('does nothing when the first confirmation is declined', async () => {
      const component = bare();
      component.dialog.open.mockReturnValue({ afterClosed: () => of(false) });
      const promptSpy = vi.fn();
      vi.stubGlobal('prompt', promptSpy);

      await component.deleteAccount();

      expect(promptSpy).not.toHaveBeenCalled();
      expect(component.profileService.deleteAccount).not.toHaveBeenCalled();
    });

    it('cancels with an error unless DELETE is typed exactly', async () => {
      const component = bare();
      vi.stubGlobal('prompt', vi.fn(() => 'delete'));

      await component.deleteAccount();

      expect(component.snackbar.error).toHaveBeenCalledWith('auth.accountDeletionCancelled');
      expect(component.profileService.deleteAccount).not.toHaveBeenCalled();
    });

    it('deletes the account and returns to login after both confirmations', async () => {
      const component = bare();
      vi.stubGlobal('prompt', vi.fn(() => 'DELETE'));

      await component.deleteAccount();

      expect(component.profileService.deleteAccount).toHaveBeenCalled();
      expect(component.router.navigate).toHaveBeenCalledWith(['/auth/login']);
      expect(component.saving()).toBe(false);
    });

    it('stays on the page when deletion fails', async () => {
      const component = bare();
      vi.stubGlobal('prompt', vi.fn(() => 'DELETE'));
      component.profileService.deleteAccount.mockResolvedValue(false);

      await component.deleteAccount();

      expect(component.router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('getInitials', () => {
    it('uses the first letters of up to two name parts', () => {
      const component = bare();
      component.displayName = 'jamie lee smith';
      expect(component.getInitials()).toBe('JL');
    });

    it('falls back to the first two letters of the email handle', () => {
      const component = bare();
      component.email = 'robin@example.com';
      expect(component.getInitials()).toBe('RO');
    });
  });
});
