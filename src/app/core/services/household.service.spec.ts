import { signal } from '@angular/core';
import { HouseholdService } from './household.service';

function chainable(result: { data?: any; error?: any } = { data: null, error: null }) {
  const obj: any = {
    select: vi.fn(() => obj),
    eq: vi.fn(() => obj),
    insert: vi.fn(() => obj),
    update: vi.fn(() => obj),
    delete: vi.fn(() => obj),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  };
  return obj;
}

function bare(): HouseholdService & Record<string, any> {
  const service = Object.create(HouseholdService.prototype) as HouseholdService & Record<string, any>;
  service.household = signal(null);
  service.members = signal([]);
  service.loading = signal(false);
  service.snackbar = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  return service;
}

describe('HouseholdService', () => {
  describe('loadHousehold', () => {
    it('does nothing when no user is authenticated', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };
      service.supabase = { from: vi.fn() };

      await service.loadHousehold();

      expect(service.supabase.from).not.toHaveBeenCalled();
    });

    it('clears household state when the user has no membership row', async () => {
      const service = bare();
      service.household.set({ id: 'old', name: 'Old', ownerId: 'u1', createdAt: '2026-01-01' });
      service.members.set([{ userId: 'u1', email: 'u1', role: 'owner', joinedAt: '2026-01-01' }]);
      service.auth = { getCurrentUserId: () => 'u1' };
      service.supabase = { from: vi.fn(() => chainable({ data: null, error: null })) };

      await service.loadHousehold();

      expect(service.household()).toBeNull();
      expect(service.members()).toEqual([]);
    });

    it('loads the household and its members when a membership row exists', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const householdMembers = chainable({
        data: { household_id: 'hh1', role: 'owner', joined_at: '2026-01-01' },
      });
      const households = chainable({
        data: { id: 'hh1', name: 'Home', owner_id: 'u1', created_at: '2026-01-01' },
      });
      const members = chainable({
        data: [{ user_id: 'u1', role: 'owner', joined_at: '2026-01-01' }],
      });
      let householdMembersCall = 0;
      service.supabase = {
        from: vi.fn((table: string) => {
          if (table === 'households') return households;
          if (table === 'household_members') {
            householdMembersCall += 1;
            return householdMembersCall === 1 ? householdMembers : members;
          }
          throw new Error(`unexpected table ${table}`);
        }),
      };

      await service.loadHousehold();

      expect(service.household()).toEqual({
        id: 'hh1',
        name: 'Home',
        ownerId: 'u1',
        createdAt: '2026-01-01',
      });
      expect(service.members()).toEqual([
        { userId: 'u1', email: 'u1', role: 'owner', joinedAt: '2026-01-01' },
      ]);
      expect(service.loading()).toBe(false);
    });

    it('resets the loading flag even when the lookup throws', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.supabase = {
        from: vi.fn(() => {
          throw new Error('network down');
        }),
      };

      await service.loadHousehold();

      expect(service.loading()).toBe(false);
    });
  });

  describe('createHousehold', () => {
    it('rejects when the user is not authenticated', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };

      await expect(service.createHousehold('Home')).rejects.toThrow('Not authenticated');
    });

    it('throws and stops when the household insert fails', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const householdError = new Error('insert failed');
      const householdsChain = chainable({ error: householdError });
      const membersChain = chainable({ error: null });
      service.supabase = {
        from: vi.fn((table: string) => (table === 'households' ? householdsChain : membersChain)),
      };

      await expect(service.createHousehold('Home')).rejects.toBe(householdError);
      expect(membersChain.insert).not.toHaveBeenCalled();
    });

    it('creates the household, adds the owner membership, and reloads', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      const householdsChain = chainable({ error: null });
      const membersChain = chainable({ error: null });
      service.supabase = {
        from: vi.fn((table: string) => (table === 'households' ? householdsChain : membersChain)),
      };
      service.loadHousehold = vi.fn(async () => {});

      await service.createHousehold('Home');

      expect(householdsChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Home', owner_id: 'u1' })
      );
      expect(membersChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'u1', role: 'owner' })
      );
      expect(service.loadHousehold).toHaveBeenCalled();
      expect(service.snackbar.success).toHaveBeenCalledWith('Household created!');
    });
  });

  describe('inviteMember', () => {
    it('rejects when there is no current household', async () => {
      const service = bare();
      await expect(service.inviteMember('a@b.com')).rejects.toThrow('No household');
    });

    it('inserts a pending invitation and notifies on success', async () => {
      const service = bare();
      service.household.set({ id: 'hh1', name: 'Home', ownerId: 'u1', createdAt: '2026-01-01' });
      const invitations = chainable({ error: null });
      service.supabase = { from: vi.fn(() => invitations) };

      await service.inviteMember('a@b.com');

      expect(invitations.insert).toHaveBeenCalledWith(
        expect.objectContaining({ household_id: 'hh1', invited_email: 'a@b.com', status: 'pending' })
      );
      expect(service.snackbar.success).toHaveBeenCalledWith('Invitation sent to a@b.com');
    });

    it('propagates a Supabase error without notifying', async () => {
      const service = bare();
      service.household.set({ id: 'hh1', name: 'Home', ownerId: 'u1', createdAt: '2026-01-01' });
      const error = new Error('duplicate invite');
      service.supabase = { from: vi.fn(() => chainable({ error })) };

      await expect(service.inviteMember('a@b.com')).rejects.toBe(error);
      expect(service.snackbar.success).not.toHaveBeenCalled();
    });
  });

  describe('acceptInvitation', () => {
    it('rejects when not authenticated', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };
      await expect(service.acceptInvitation('inv1')).rejects.toThrow('Not authenticated');
    });

    it('rejects when the invitation cannot be found', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u2' };
      service.supabase = { from: vi.fn(() => chainable({ data: null })) };

      await expect(service.acceptInvitation('inv1')).rejects.toThrow(
        'Invitation not found or already used'
      );
    });

    it('joins the household and marks the invitation accepted', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u2' };
      const invitations = chainable({ data: { household_id: 'hh1', status: 'pending' } });
      const members = chainable({ error: null });
      service.supabase = {
        from: vi.fn((table: string) => (table === 'household_invitations' ? invitations : members)),
      };
      service.loadHousehold = vi.fn(async () => {});

      await service.acceptInvitation('inv1');

      expect(members.insert).toHaveBeenCalledWith(
        expect.objectContaining({ household_id: 'hh1', user_id: 'u2', role: 'member' })
      );
      expect(invitations.update).toHaveBeenCalledWith({ status: 'accepted' });
      expect(service.loadHousehold).toHaveBeenCalled();
      expect(service.snackbar.success).toHaveBeenCalledWith('Joined household!');
    });
  });

  describe('leaveHousehold', () => {
    it('does nothing without an authenticated user or household', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };
      service.supabase = { from: vi.fn() };

      await service.leaveHousehold();

      expect(service.supabase.from).not.toHaveBeenCalled();
    });

    it('removes the membership and clears household state', async () => {
      const service = bare();
      service.household.set({ id: 'hh1', name: 'Home', ownerId: 'owner', createdAt: '2026-01-01' });
      service.members.set([{ userId: 'u2', email: 'u2', role: 'member', joinedAt: '2026-01-01' }]);
      service.auth = { getCurrentUserId: () => 'u2' };
      service.supabase = { from: vi.fn(() => chainable({ error: null })) };

      await service.leaveHousehold();

      expect(service.household()).toBeNull();
      expect(service.members()).toEqual([]);
      expect(service.snackbar.success).toHaveBeenCalledWith('You left the household');
    });

    it('throws when the delete fails', async () => {
      const service = bare();
      service.household.set({ id: 'hh1', name: 'Home', ownerId: 'owner', createdAt: '2026-01-01' });
      service.auth = { getCurrentUserId: () => 'u2' };
      const error = new Error('delete failed');
      service.supabase = { from: vi.fn(() => chainable({ error })) };

      await expect(service.leaveHousehold()).rejects.toBe(error);
      expect(service.household()).not.toBeNull();
    });
  });

  describe('removeMember', () => {
    it('does nothing without a current household', async () => {
      const service = bare();
      service.supabase = { from: vi.fn() };
      await service.removeMember('u2');
      expect(service.supabase.from).not.toHaveBeenCalled();
    });

    it('rejects when a non-owner tries to remove someone else', async () => {
      const service = bare();
      service.household.set({ id: 'hh1', name: 'Home', ownerId: 'owner', createdAt: '2026-01-01' });
      service.auth = { getCurrentUserId: () => 'u2' };

      await expect(service.removeMember('u3')).rejects.toThrow(
        'Only the household owner can remove other members'
      );
    });

    it('allows a member to remove themselves', async () => {
      const service = bare();
      service.household.set({ id: 'hh1', name: 'Home', ownerId: 'owner', createdAt: '2026-01-01' });
      service.auth = { getCurrentUserId: () => 'u2' };
      const members = chainable({ error: null });
      service.supabase = { from: vi.fn(() => members) };
      service.loadMembers = vi.fn(async () => {});

      await service.removeMember('u2');

      expect(members.delete).toHaveBeenCalled();
      expect(service.snackbar.success).toHaveBeenCalledWith('Member removed');
    });

    it('allows the owner to remove another member', async () => {
      const service = bare();
      service.household.set({ id: 'hh1', name: 'Home', ownerId: 'owner', createdAt: '2026-01-01' });
      service.auth = { getCurrentUserId: () => 'owner' };
      const members = chainable({ error: null });
      service.supabase = { from: vi.fn(() => members) };
      service.loadMembers = vi.fn(async () => {});

      await service.removeMember('u2');

      expect(members.delete).toHaveBeenCalled();
      expect(service.loadMembers).toHaveBeenCalledWith('hh1');
    });
  });

  describe('getHouseholdUserIds', () => {
    it('returns just the current user when there is no household', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      await expect(service.getHouseholdUserIds()).resolves.toEqual(['u1']);
    });

    it('returns an empty list when there is no household and no user', async () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };
      await expect(service.getHouseholdUserIds()).resolves.toEqual([]);
    });

    it('returns every member id when a household exists', async () => {
      const service = bare();
      service.household.set({ id: 'hh1', name: 'Home', ownerId: 'owner', createdAt: '2026-01-01' });
      service.supabase = {
        from: vi.fn(() => chainable({ data: [{ user_id: 'owner' }, { user_id: 'u2' }] })),
      };

      await expect(service.getHouseholdUserIds()).resolves.toEqual(['owner', 'u2']);
    });
  });
});
