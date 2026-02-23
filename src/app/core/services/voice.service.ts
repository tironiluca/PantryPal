import { Injectable, inject, signal } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { DbService } from './db.service';
import { AuthService } from './auth.service';

export interface VoiceSettings {
  userId: string;
  enabled: boolean;
  language: string;
  continuousMode: boolean;
}

export interface VoiceTranscript {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root',
})
export class VoiceService {
  private db = inject(DbService);
  private auth = inject(AuthService);

  private recognition: any = null;
  private isListening = signal(false);
  private transcriptSubject = new Subject<VoiceTranscript>();
  private errorSubject = new Subject<string>();

  // Public observables
  transcript$ = this.transcriptSubject.asObservable();
  error$ = this.errorSubject.asObservable();
  listening = this.isListening.asReadonly();

  /**
   * Check if Web Speech API is supported
   */
  isSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /**
   * Initialize speech recognition
   */
  private initializeRecognition(): void {
    if (this.recognition) {
      return; // Already initialized
    }

    if (!this.isSupported()) {
      throw new Error('Speech recognition is not supported in this browser');
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    const settings = this.getSettings();
    this.recognition.lang = settings.language || 'en-US';
    this.recognition.continuous = settings.continuousMode;
    this.recognition.interimResults = true; // Get interim results as user speaks
    this.recognition.maxAlternatives = 1;

    // Event handlers
    this.recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;
      const isFinal = result.isFinal;

      this.transcriptSubject.next({
        transcript,
        confidence,
        isFinal,
        timestamp: new Date(),
      });
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.errorSubject.next(event.error);

      // Stop listening on critical errors
      if (['no-speech', 'audio-capture', 'not-allowed'].includes(event.error)) {
        this.stopListening();
      }
    };

    this.recognition.onend = () => {
      this.isListening.set(false);

      // Restart if in continuous mode and not manually stopped
      if (settings.continuousMode && this.recognition) {
        try {
          this.recognition.start();
          this.isListening.set(true);
        } catch (e) {
          console.warn('Could not restart continuous recognition:', e);
        }
      }
    };
  }

  /**
   * Start listening for voice commands
   */
  startListening(): void {
    const settings = this.getSettings();
    if (!settings.enabled) {
      throw new Error('Voice commands are disabled in settings');
    }

    if (!this.isSupported()) {
      throw new Error('Speech recognition is not supported in this browser');
    }

    if (this.isListening()) {
      console.warn('Already listening');
      return;
    }

    try {
      this.initializeRecognition();
      this.recognition.start();
      this.isListening.set(true);
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      this.errorSubject.next('Failed to start voice recognition');
      throw error;
    }
  }

  /**
   * Stop listening for voice commands
   */
  stopListening(): void {
    if (!this.recognition || !this.isListening()) {
      return;
    }

    try {
      this.recognition.stop();
      this.isListening.set(false);
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
    }
  }

  /**
   * Toggle listening state
   */
  toggleListening(): void {
    if (this.isListening()) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  /**
   * Get voice settings for current user
   */
  getSettings(): VoiceSettings {
    const userId = this.auth.getCurrentUserId();
    if (!userId) {
      return {
        userId: '',
        enabled: false,
        language: 'en-US',
        continuousMode: false,
      };
    }

    const settings = this.db.query<any>(
      'SELECT * FROM voice_settings WHERE userId = ?',
      [userId]
    );

    if (settings.length === 0) {
      // Return default settings
      return {
        userId,
        enabled: true,
        language: 'en-US',
        continuousMode: false,
      };
    }

    const s = settings[0];
    return {
      userId: s.userId,
      enabled: !!s.enabled,
      language: s.language || 'en-US',
      continuousMode: !!s.continuousMode,
    };
  }

  /**
   * Update voice settings for current user
   */
  updateSettings(settings: Partial<Omit<VoiceSettings, 'userId'>>): void {
    const userId = this.auth.getCurrentUserId();
    if (!userId) {
      throw new Error('User must be authenticated to update settings');
    }

    const now = new Date().toISOString();
    const existing = this.getSettings();

    const newSettings = {
      enabled: settings.enabled !== undefined ? settings.enabled : existing.enabled,
      language: settings.language || existing.language,
      continuousMode: settings.continuousMode !== undefined ? settings.continuousMode : existing.continuousMode,
    };

    const existingRecord = this.db.query<any>(
      'SELECT * FROM voice_settings WHERE userId = ?',
      [userId]
    );

    if (existingRecord.length === 0) {
      // Insert new settings
      this.db.exec(
        'INSERT INTO voice_settings (userId, enabled, language, continuousMode, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [userId, newSettings.enabled ? 1 : 0, newSettings.language, newSettings.continuousMode ? 1 : 0, now]
      );
    } else {
      // Update existing settings
      this.db.exec(
        'UPDATE voice_settings SET enabled = ?, language = ?, continuousMode = ?, updatedAt = ? WHERE userId = ?',
        [newSettings.enabled ? 1 : 0, newSettings.language, newSettings.continuousMode ? 1 : 0, now, userId]
      );
    }

    // Update recognition settings if active
    if (this.recognition) {
      this.recognition.lang = newSettings.language;
      this.recognition.continuous = newSettings.continuousMode;

      // Restart if currently listening
      if (this.isListening()) {
        this.stopListening();
        setTimeout(() => this.startListening(), 100);
      }
    }
  }

  /**
   * Log a voice command
   */
  logCommand(transcript: string, command: string | null, success: boolean): void {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return;

    const id = `voice-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const timestamp = new Date().toISOString();

    this.db.exec(
      'INSERT INTO voice_command_log (id, userId, transcript, command, success, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, transcript, command || null, success ? 1 : 0, timestamp]
    );
  }

  /**
   * Get available languages for speech recognition
   */
  getSupportedLanguages(): Array<{ code: string; name: string }> {
    return [
      { code: 'en-US', name: 'English (US)' },
      { code: 'en-GB', name: 'English (UK)' },
      { code: 'es-ES', name: 'Spanish (Spain)' },
      { code: 'es-MX', name: 'Spanish (Mexico)' },
      { code: 'fr-FR', name: 'French' },
      { code: 'de-DE', name: 'German' },
      { code: 'it-IT', name: 'Italian' },
      { code: 'pt-BR', name: 'Portuguese (Brazil)' },
      { code: 'pt-PT', name: 'Portuguese (Portugal)' },
      { code: 'ru-RU', name: 'Russian' },
      { code: 'ja-JP', name: 'Japanese' },
      { code: 'zh-CN', name: 'Chinese (Simplified)' },
      { code: 'zh-TW', name: 'Chinese (Traditional)' },
      { code: 'ko-KR', name: 'Korean' },
      { code: 'ar-SA', name: 'Arabic' },
      { code: 'hi-IN', name: 'Hindi' },
    ];
  }

  /**
   * Clean up resources.
   * NOTE: Subjects are intentionally NOT completed here (BUG-17) — completing a Subject
   * permanently prevents future emissions even if startListening() is called again.
   * Stopping the recognition session is sufficient cleanup for a root-level service.
   */
  destroy(): void {
    this.stopListening();
    this.recognition = null;
  }
}
