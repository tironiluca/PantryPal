import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { VoiceService, VoiceTranscript } from './voice.service';

class FakeRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  start = vi.fn();
  stop = vi.fn();
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
}

function bare(): VoiceService & Record<string, any> {
  const service = Object.create(VoiceService.prototype) as VoiceService & Record<string, any>;
  service.recognition = null;
  service.isListening = signal(false);
  service.transcriptSubject = new Subject<VoiceTranscript>();
  service.errorSubject = new Subject<string>();
  return service;
}

function stubRecognitionApi() {
  (window as any).SpeechRecognition = FakeRecognition;
}

describe('VoiceService', () => {
  afterEach(() => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
  });

  describe('isSupported', () => {
    it('is false when neither recognition API is present', () => {
      const service = bare();
      expect(service.isSupported()).toBe(false);
    });

    it('is true when SpeechRecognition is present', () => {
      stubRecognitionApi();
      const service = bare();
      expect(service.isSupported()).toBe(true);
    });
  });

  describe('getSettings', () => {
    it('returns disabled defaults without a user', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };

      expect(service.getSettings()).toEqual({
        userId: '',
        enabled: false,
        language: 'en-US',
        continuousMode: false,
      });
    });

    it('returns enabled defaults for a user with no stored row', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { query: vi.fn(() => []) };

      expect(service.getSettings()).toEqual({
        userId: 'u1',
        enabled: true,
        language: 'en-US',
        continuousMode: false,
      });
    });

    it('coerces the stored row booleans', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = {
        query: vi.fn(() => [{ userId: 'u1', enabled: 0, language: 'it-IT', continuousMode: 1 }]),
      };

      expect(service.getSettings()).toEqual({
        userId: 'u1',
        enabled: false,
        language: 'it-IT',
        continuousMode: true,
      });
    });
  });

  describe('startListening / stopListening', () => {
    it('throws when voice commands are disabled', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };

      expect(() => service.startListening()).toThrow('Voice commands are disabled in settings');
    });

    it('throws when the browser does not support speech recognition', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { query: vi.fn(() => []) };

      expect(() => service.startListening()).toThrow(
        'Speech recognition is not supported in this browser'
      );
    });

    it('warns and no-ops when already listening', () => {
      stubRecognitionApi();
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { query: vi.fn(() => []) };
      service.isListening.set(true);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      service.startListening();

      expect(warn).toHaveBeenCalledWith('Already listening');
      warn.mockRestore();
    });

    it('initializes recognition, starts it, and flips the listening flag', () => {
      stubRecognitionApi();
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { query: vi.fn(() => []) };

      service.startListening();

      expect(service.recognition).toBeInstanceOf(FakeRecognition);
      expect(service.recognition.start).toHaveBeenCalled();
      expect(service.isListening()).toBe(true);
    });

    it('propagates and reports a failure to start recognition', () => {
      stubRecognitionApi();
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { query: vi.fn(() => []) };
      service.recognition = new FakeRecognition();
      service.recognition.start.mockImplementation(() => {
        throw new Error('mic denied');
      });

      let emitted: string | undefined;
      service.errorSubject.subscribe((e: string) => (emitted = e));

      expect(() => service.startListening()).toThrow('mic denied');
      expect(emitted).toBe('Failed to start voice recognition');
      expect(service.isListening()).toBe(false);
    });

    it('does nothing when stopping without an active session', () => {
      const service = bare();
      expect(() => service.stopListening()).not.toThrow();
    });

    it('stops the active recognition session', () => {
      const service = bare();
      service.recognition = new FakeRecognition();
      service.isListening.set(true);

      service.stopListening();

      expect(service.recognition.stop).toHaveBeenCalled();
      expect(service.isListening()).toBe(false);
    });

    it('logs instead of throwing when stop() fails', () => {
      const service = bare();
      service.recognition = new FakeRecognition();
      service.recognition.stop.mockImplementation(() => {
        throw new Error('already stopped');
      });
      service.isListening.set(true);

      expect(() => service.stopListening()).not.toThrow();
    });
  });

  describe('toggleListening', () => {
    it('stops when currently listening', () => {
      const service = bare();
      service.stopListening = vi.fn();
      service.startListening = vi.fn();
      service.isListening.set(true);

      service.toggleListening();

      expect(service.stopListening).toHaveBeenCalled();
      expect(service.startListening).not.toHaveBeenCalled();
    });

    it('starts when not currently listening', () => {
      const service = bare();
      service.stopListening = vi.fn();
      service.startListening = vi.fn();

      service.toggleListening();

      expect(service.startListening).toHaveBeenCalled();
      expect(service.stopListening).not.toHaveBeenCalled();
    });
  });

  describe('recognition event handlers', () => {
    it('emits a transcript for the latest result', () => {
      stubRecognitionApi();
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { query: vi.fn(() => []) };
      service.startListening();

      const events: VoiceTranscript[] = [];
      service.transcriptSubject.subscribe((t: VoiceTranscript) => events.push(t));

      service.recognition.onresult({
        results: [
          [{ transcript: 'ignored', confidence: 0.1, isFinal: false }],
          Object.assign([{ transcript: 'add milk', confidence: 0.95 }], { isFinal: true }),
        ],
      });

      expect(events).toEqual([
        { transcript: 'add milk', confidence: 0.95, isFinal: true, timestamp: expect.any(Date) },
      ]);
    });

    it('emits the error and stops listening on a critical error', () => {
      stubRecognitionApi();
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { query: vi.fn(() => []) };
      service.startListening();

      const errors: string[] = [];
      service.errorSubject.subscribe((e: string) => errors.push(e));

      service.recognition.onerror({ error: 'not-allowed' });

      expect(errors).toEqual(['not-allowed']);
      expect(service.recognition.stop).toHaveBeenCalled();
    });

    it('keeps listening after a non-critical error', () => {
      stubRecognitionApi();
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { query: vi.fn(() => []) };
      service.startListening();

      service.recognition.onerror({ error: 'network' });

      expect(service.recognition.stop).not.toHaveBeenCalled();
    });

    it('restarts automatically on end when continuous mode is enabled', () => {
      stubRecognitionApi();
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = {
        query: vi.fn(() => [{ userId: 'u1', enabled: 1, language: 'en-US', continuousMode: 1 }]),
      };
      service.startListening();
      service.recognition.start.mockClear();

      service.recognition.onend();

      expect(service.recognition.start).toHaveBeenCalled();
      expect(service.isListening()).toBe(true);
    });

    it('stays stopped on end when continuous mode is disabled', () => {
      stubRecognitionApi();
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { query: vi.fn(() => []) };
      service.startListening();
      service.recognition.start.mockClear();

      service.recognition.onend();

      expect(service.recognition.start).not.toHaveBeenCalled();
      expect(service.isListening()).toBe(false);
    });
  });

  describe('updateSettings', () => {
    it('throws when not authenticated', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };

      expect(() => service.updateSettings({ enabled: false })).toThrow(
        'User must be authenticated to update settings'
      );
    });

    it('inserts settings when none exist yet', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { query: vi.fn(() => []), exec: vi.fn() };

      service.updateSettings({ enabled: false, language: 'it-IT' });

      const [sql, params] = service.db.exec.mock.calls[0];
      expect(sql).toContain('INSERT INTO voice_settings');
      expect(params).toEqual(['u1', 0, 'it-IT', 0, expect.any(String)]);
    });

    it('updates settings when a row already exists', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = {
        query: vi.fn(() => [{ userId: 'u1', enabled: 1, language: 'en-US', continuousMode: 0 }]),
        exec: vi.fn(),
      };

      service.updateSettings({ continuousMode: true });

      const [sql, params] = service.db.exec.mock.calls[0];
      expect(sql).toContain('UPDATE voice_settings');
      expect(params).toEqual([1, 'en-US', 1, expect.any(String), 'u1']);
    });

    it('applies new language/continuity to an active recognition session', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { query: vi.fn(() => []), exec: vi.fn() };
      service.recognition = new FakeRecognition();

      service.updateSettings({ language: 'fr-FR', continuousMode: true });

      expect(service.recognition.lang).toBe('fr-FR');
      expect(service.recognition.continuous).toBe(true);
    });

    it('restarts listening shortly after updating settings while active', () => {
      vi.useFakeTimers();
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { query: vi.fn(() => []), exec: vi.fn() };
      service.recognition = new FakeRecognition();
      service.isListening.set(true);
      service.startListening = vi.fn();

      service.updateSettings({ language: 'fr-FR' });
      expect(service.recognition.stop).toHaveBeenCalled();
      expect(service.startListening).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(service.startListening).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('logCommand', () => {
    it('does nothing without an authenticated user', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => null };
      service.db = { exec: vi.fn() };

      service.logCommand('add milk', 'add', true);

      expect(service.db.exec).not.toHaveBeenCalled();
    });

    it('logs the command for the current user', () => {
      const service = bare();
      service.auth = { getCurrentUserId: () => 'u1' };
      service.db = { exec: vi.fn() };

      service.logCommand('add milk', 'add', true);

      const [sql, params] = service.db.exec.mock.calls[0];
      expect(sql).toContain('INSERT INTO voice_command_log');
      expect(params).toEqual([
        expect.stringContaining('voice-'),
        'u1',
        'add milk',
        'add',
        1,
        expect.any(String),
      ]);
    });
  });

  it('lists the supported recognition languages', () => {
    const service = bare();
    const languages = service.getSupportedLanguages();
    expect(languages.length).toBeGreaterThan(0);
    expect(languages).toContainEqual({ code: 'it-IT', name: 'Italian' });
  });

  describe('destroy', () => {
    it('stops listening and clears the recognition instance', () => {
      const service = bare();
      service.recognition = new FakeRecognition();
      service.isListening.set(true);

      service.destroy();

      expect(service.recognition).toBeNull();
      expect(service.isListening()).toBe(false);
    });
  });
});
