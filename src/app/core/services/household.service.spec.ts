import { signal } from '@angular/core';
import { HOUSEHOLD_MIGRATION_MISSING_MESSAGE, HouseholdService, toUserError } from './household.service';

function chainable(result: { data?: any; error?: any } = { data: null, error: null }) {
  const obj: any = {
    select: vi.fn(() => obj),
    eq: vi.fn(() => obj),
    maybeSingle: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
    then: (resolve: any, reject?: any) =>
      Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(resolve, reject),
  };
  return obj;
}

function bare(): HouseholdService & Record<string, any> {
  const service = Object.create(HouseholdService.prototype) as HouseholdService & Record<string, any>;
  service.household = signal(null);
  service.members = signal([]);
  service.invitations = signal([]);
  service.loading = signal(false);
  service.loadError = signal(null);
  service.snackbar = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  service.auth = { getCurrentUserId: () => 'u1' };
  service.db = { setHouseholdMembers: vi.fn() };
  service.supabase = { from: vi.fn(() => chainable()), rpc: vi.fn(async () => ({ data: null, error: null })) };
  return service;
}

const HOUSEHOLD = { id: 'hh1', name: 'Home', ownerId: 'u1', createdAt: '2026-01-01' };

describe('toUserError', () => {
  it('explains a missing database function as a pending migration', () => {
    expect(toUserError({ code: 'PGRST202', message: 'Could not find the function public.create_household' }).message)
      .toBe(HOUSEHOLD_MIGRATION_MISSING_MESSAGE);
    expect(toUserError({ message: 'Could not find the function x in the schema cache' }).message)
      .toBe(HOUSEHOLD_MIGRATION_MISSING_MESSAGE);
  });

  it('keeps other database messages', () => {
    expect(toUserError({ code: '23505', message: 'You already belong to a household' }).message)
      .toBe('You already belong to a household');
    expect(toUserError(null).message).toBe('Unknown error');
  });
});

describe('HouseholdService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  describe('loadHousehold', () => {
    it('does nothing when no user is authenticated', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };

      await service.loadHousehold();

      expect(service.supabase.from).not.toHaveBeenCalled();
    });

    it('clears household state and loads invitations when the user has no membership', async () => {
      const service = bare();
      service.household.set(HOUSEHOLD);
      service.members.set([{ userId: 'u1', email: 'u1', role: 'owner', joinedAt: '2026-01-01' }]);
      service.supabase.rpc = vi.fn(async () => ({
        data: [{ id: 'inv1', household_id: 'hh9', household_name: 'Olive home', invited_at: '2026-02-01' }],
        error: null,
      }));

      await service.loadHousehold();

      expect(service.household()).toBeNull();
      expect(service.members()).toEqual([]);
      expect(service.db.setHouseholdMembers).toHaveBeenCalledWith([]);
      expect(service.supabase.rpc).toHaveBeenCalledWith('my_pending_invitations', undefined);
      expect(service.invitations()).toEqual([
        { id: 'inv1', householdId: 'hh9', householdName: 'Olive home', invitedAt: '2026-02-01' },
      ]);
      expect(service.loading()).toBe(false);
    });

    it('loads the household and member details with emails', async () => {
      const service = bare();
      service.supabase.from = vi.fn((table: string) =>
        table === 'household_members'
          ? chainable({ data: { household_id: 'hh1', role: 'owner', joined_at: '2026-01-01' } })
          : chainable({ data: { id: 'hh1', name: 'Home', owner_id: 'u1', created_at: '2026-01-01' } })
      );
      service.supabase.rpc = vi.fn(async () => ({
        data: [
          { user_id: 'u1', email: 'olive@example.test', display_name: 'Olive', role: 'owner', joined_at: '2026-01-01' },
          { user_id: 'u2', email: null, display_name: null, role: 'member', joined_at: '2026-01-02' },
        ],
        error: null,
      }));

      await service.loadHousehold();

      expect(service.household()).toEqual(HOUSEHOLD);
      expect(service.supabase.rpc).toHaveBeenCalledWith('household_member_details', undefined);
      expect(service.db.setHouseholdMembers).toHaveBeenCalledWith(['u1', 'u2']);
      expect(service.members()).toEqual([
        { userId: 'u1', email: 'olive@example.test', displayName: 'Olive', role: 'owner', joinedAt: '2026-01-01' },
        { userId: 'u2', email: 'u2', displayName: undefined, role: 'member', joinedAt: '2026-01-02' },
      ]);
      expect(service.loadError()).toBeNull();
    });

    it('surfaces a query error instead of presenting "no household"', async () => {
      const service = bare();
      service.supabase.from = vi.fn(() =>
        chainable({ error: { code: '42P17', message: 'infinite recursion detected in policy for relation "household_members"' } })
      );

      await service.loadHousehold();

      expect(service.loadError()).toContain('infinite recursion');
      expect(service.loading()).toBe(false);
    });

    it('reports a pending migration when the invitation function is missing', async () => {
      const service = bare();
      service.supabase.rpc = vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }));

      await service.loadHousehold();

      expect(service.loadError()).toBe(HOUSEHOLD_MIGRATION_MISSING_MESSAGE);
    });
  });

  describe('createHousehold', () => {
    it('creates the household through the database function and reloads', async () => {
      const service = bare();
      service.loadHousehold = vi.fn().mockResolvedValue(undefined);

      await service.createHousehold('Home');

      expect(service.supabase.rpc).toHaveBeenCalledWith('create_household', { p_name: 'Home' });
      expect(service.loadHousehold).toHaveBeenCalled();
      expect(service.snackbar.success).toHaveBeenCalledWith('Household created!');
    });

    it('throws when not authenticated', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };

      await expect(service.createHousehold('Home')).rejects.toThrow('Not authenticated');
      expect(service.supabase.rpc).not.toHaveBeenCalled();
    });

    it('propagates database errors without reporting success', async () => {
      const service = bare();
      service.supabase.rpc = vi.fn(async () => ({ data: null, error: { code: '23505', message: 'You already belong to a household' } }));

      await expect(service.createHousehold('Home')).rejects.toThrow('You already belong to a household');
      expect(service.snackbar.success).not.toHaveBeenCalled();
    });

    it('fails visibly when the database has not been migrated', async () => {
      const service = bare();
      service.supabase.rpc = vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }));

      await expect(service.createHousehold('Home')).rejects.toThrow(HOUSEHOLD_MIGRATION_MISSING_MESSAGE);
    });
  });

  describe('inviteMember', () => {
    it('throws when there is no household', async () => {
      await expect(bare().inviteMember('a@b.test')).rejects.toThrow('No household');
    });

    it('creates the invitation without claiming an email was sent', async () => {
      const service = bare();
      service.household.set(HOUSEHOLD);

      await service.inviteMember('mia@example.test');

      expect(service.supabase.rpc).toHaveBeenCalledWith('invite_household_member', { p_email: 'mia@example.test' });
      const message: string = service.snackbar.success.mock.calls[0][0];
      expect(message).toContain('Invitation created for mia@example.test');
      expect(message).not.toMatch(/sent/i);
    });

    it('propagates errors', async () => {
      const service = bare();
      service.household.set(HOUSEHOLD);
      service.supabase.rpc = vi.fn(async () => ({ data: null, error: { message: 'Enter a valid email address' } }));

      await expect(service.inviteMember('x')).rejects.toThrow('Enter a valid email address');
    });
  });

  describe('invitations', () => {
    it('accepts an invitation and reloads the household', async () => {
      const service = bare();
      service.loadHousehold = vi.fn().mockResolvedValue(undefined);

      await service.acceptInvitation('inv1');

      expect(service.supabase.rpc).toHaveBeenCalledWith('accept_household_invitation', { p_invitation_id: 'inv1' });
      expect(service.loadHousehold).toHaveBeenCalled();
      expect(service.snackbar.success).toHaveBeenCalledWith('Joined household!');
    });

    it('requires authentication to accept', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };
      await expect(service.acceptInvitation('inv1')).rejects.toThrow('Not authenticated');
    });

    it('propagates a used or foreign invitation error', async () => {
      const service = bare();
      service.supabase.rpc = vi.fn(async () => ({ data: null, error: { message: 'Invitation not found or already used' } }));
      await expect(service.acceptInvitation('inv1')).rejects.toThrow('Invitation not found or already used');
    });

    it('declines an invitation and removes it from the inbox', async () => {
      const service = bare();
      service.invitations.set([
        { id: 'inv1', householdId: 'h1', householdName: 'A', invitedAt: '' },
        { id: 'inv2', householdId: 'h2', householdName: 'B', invitedAt: '' },
      ]);

      await service.declineInvitation('inv1');

      expect(service.supabase.rpc).toHaveBeenCalledWith('decline_household_invitation', { p_invitation_id: 'inv1' });
      expect(service.invitations().map((i) => i.id)).toEqual(['inv2']);
    });
  });

  describe('leaveHousehold', () => {
    it('does nothing without a household', async () => {
      const service = bare();
      await service.leaveHousehold();
      expect(service.supabase.rpc).not.toHaveBeenCalled();
    });

    it('leaves through the database function and clears local state', async () => {
      const service = bare();
      service.household.set(HOUSEHOLD);
      service.members.set([{ userId: 'u1', email: 'u1', role: 'owner', joinedAt: '' }]);

      await service.leaveHousehold();

      expect(service.supabase.rpc).toHaveBeenCalledWith('leave_household', undefined);
      expect(service.db.setHouseholdMembers).toHaveBeenCalledWith([]);
      expect(service.household()).toBeNull();
      expect(service.members()).toEqual([]);
    });

    it('keeps the household when leaving fails', async () => {
      const service = bare();
      service.household.set(HOUSEHOLD);
      service.supabase.rpc = vi.fn(async () => ({ data: null, error: { message: 'boom' } }));

      await expect(service.leaveHousehold()).rejects.toThrow('boom');
      expect(service.household()).toEqual(HOUSEHOLD);
    });
  });

  describe('removeMember', () => {
    it('does nothing without a household', async () => {
      const service = bare();
      await service.removeMember('u2');
      expect(service.supabase.rpc).not.toHaveBeenCalled();
    });

    it('refuses to let a non-owner remove someone else', async () => {
      const service = bare();
      service.household.set({ ...HOUSEHOLD, ownerId: 'u9' });
      await expect(service.removeMember('u2')).rejects.toThrow('Only the household owner can remove other members');
    });

    it('removes a member through the database function and reloads members', async () => {
      const service = bare();
      service.household.set(HOUSEHOLD);
      service.supabase.rpc = vi.fn(async (fn: string) => ({ data: fn === 'household_member_details' ? [] : null, error: null }));

      await service.removeMember('u2');

      expect(service.supabase.rpc).toHaveBeenCalledWith('remove_household_member', { p_user_id: 'u2' });
      expect(service.supabase.rpc).toHaveBeenCalledWith('household_member_details', undefined);
      expect(service.snackbar.success).toHaveBeenCalledWith('Member removed');
    });
  });

  describe('getHouseholdUserIds', () => {
    it('returns only the current user without a household', async () => {
      expect(await bare().getHouseholdUserIds()).toEqual(['u1']);
    });

    it('returns an empty list when signed out and without a household', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };
      expect(await service.getHouseholdUserIds()).toEqual([]);
    });

    it('returns every member of the household', async () => {
      const service = bare();
      service.household.set(HOUSEHOLD);
      service.supabase.from = vi.fn(() => chainable({ data: [{ user_id: 'u1' }, { user_id: 'u2' }] }));

      expect(await service.getHouseholdUserIds()).toEqual(['u1', 'u2']);
      expect(service.db.setHouseholdMembers).toHaveBeenCalledWith(['u1', 'u2']);
    });

    it('falls back to the current user when members cannot be read', async () => {
      const service = bare();
      service.household.set(HOUSEHOLD);
      service.supabase.from = vi.fn(() => chainable({ error: { message: 'denied' } }));

      expect(await service.getHouseholdUserIds()).toEqual(['u1']);
      expect(service.db.setHouseholdMembers).not.toHaveBeenCalled();
    });
  });

  describe('init', () => {
    it('loads the household', async () => {
      const service = bare();
      service.loadHousehold = vi.fn().mockResolvedValue(undefined);
      await service.init();
      expect(service.loadHousehold).toHaveBeenCalled();
    });
  });
});
