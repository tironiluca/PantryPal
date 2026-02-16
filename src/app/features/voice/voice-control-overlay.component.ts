import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { VoiceService, VoiceTranscript } from '../../core/services/voice.service';
import { VoiceCommandService, ParsedCommand } from '../../core/services/voice-command.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'pp-voice-control-overlay',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule,
  ],
  template: `
    @if (isListening()) {
      <div class="voice-overlay" (click)="onOverlayClick()">
        <div class="voice-container" (click)="$event.stopPropagation()">
          <!-- Microphone Icon with Animation -->
          <div class="mic-container">
            <div class="pulse-ring"></div>
            <div class="mic-icon" [class.active]="isProcessing()">
              <mat-icon>mic</mat-icon>
            </div>
          </div>

          <!-- Transcript Display -->
          <div class="transcript-container">
            @if (currentTranscript()) {
              <div class="transcript" [class.final]="isFinalTranscript()">
                {{ currentTranscript() }}
              </div>
            } @else {
              <div class="listening-text">Listening...</div>
            }

            @if (lastCommand(); as cmd) {
              <div class="command-info">
                <mat-icon class="command-icon">{{ getCommandIcon(cmd.action) }}</mat-icon>
                <span>{{ getCommandLabel(cmd) }}</span>
              </div>
            }
          </div>

          <!-- Suggestions -->
          <div class="suggestions">
            <div class="suggestions-title">Try saying:</div>
            <div class="suggestions-list">
              @for (suggestion of suggestions; track $index) {
                <mat-chip>{{ suggestion }}</mat-chip>
              }
            </div>
          </div>

          <!-- Controls -->
          <div class="controls">
            <button
              mat-icon-button
              (click)="stopListening()"
              matTooltip="Stop listening"
              color="warn"
            >
              <mat-icon>stop</mat-icon>
            </button>
            <button
              mat-button
              (click)="showHelp()"
              matTooltip="Show all commands"
            >
              <mat-icon>help</mat-icon>
              Help
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .voice-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .voice-container {
      background: var(--surface-color);
      border-radius: 24px;
      padding: var(--spacing-xl);
      max-width: 600px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-lg);
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        transform: translateY(30px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .mic-container {
      position: relative;
      width: 120px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pulse-ring {
      position: absolute;
      width: 100%;
      height: 100%;
      border: 3px solid var(--primary-color);
      border-radius: 50%;
      animation: pulse 1.5s ease-out infinite;
    }

    @keyframes pulse {
      0% {
        transform: scale(0.8);
        opacity: 1;
      }
      100% {
        transform: scale(1.2);
        opacity: 0;
      }
    }

    .mic-icon {
      width: 80px;
      height: 80px;
      background: var(--primary-color);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;

      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: white;
      }

      &.active {
        background: var(--accent-color);
        transform: scale(1.1);
      }
    }

    .transcript-container {
      min-height: 80px;
      width: 100%;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .transcript {
      font-size: 24px;
      line-height: 1.4;
      color: var(--text-secondary);
      padding: var(--spacing-md);
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.05);
      min-height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;

      &.final {
        color: var(--text-primary);
        font-weight: 600;
      }
    }

    .listening-text {
      font-size: 20px;
      color: var(--text-secondary);
      font-style: italic;
    }

    .command-info {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      padding: var(--spacing-sm) var(--spacing-md);
      background: var(--primary-color);
      color: white;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;

      .command-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .suggestions {
      width: 100%;
      border-top: 1px solid var(--divider-color);
      padding-top: var(--spacing-md);

      .suggestions-title {
        font-size: 12px;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: var(--spacing-sm);
      }

      .suggestions-list {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);

        mat-chip {
          font-size: 13px;
          cursor: default;
        }
      }
    }

    .controls {
      display: flex;
      gap: var(--spacing-md);
      align-items: center;

      button {
        mat-icon {
          margin-right: var(--spacing-xs);
        }
      }
    }

    @media (max-width: 768px) {
      .voice-container {
        width: 95%;
        padding: var(--spacing-lg);
      }

      .mic-container {
        width: 100px;
        height: 100px;
      }

      .mic-icon {
        width: 70px;
        height: 70px;

        mat-icon {
          font-size: 35px;
          width: 35px;
          height: 35px;
        }
      }

      .transcript {
        font-size: 20px;
      }
    }
  `],
})
export class VoiceControlOverlayComponent implements OnInit, OnDestroy {
  private voiceService = inject(VoiceService);
  private commandService = inject(VoiceCommandService);
  private snackbar = inject(SnackbarService);

  isListening = this.voiceService.listening;
  currentTranscript = signal<string>('');
  isFinalTranscript = signal(false);
  isProcessing = signal(false);
  lastCommand = signal<ParsedCommand | null>(null);

  suggestions = [
    'Go to recipes',
    'Add ingredient',
    'Search for milk',
    'Show inventory',
  ];

  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    // Subscribe to voice transcripts
    this.subscriptions.push(
      this.voiceService.transcript$.subscribe((transcript: VoiceTranscript) => {
        this.currentTranscript.set(transcript.transcript);
        this.isFinalTranscript.set(transcript.isFinal);

        if (transcript.isFinal) {
          this.processTranscript(transcript.transcript);
        } else {
          this.isProcessing.set(true);
        }
      })
    );

    // Subscribe to errors
    this.subscriptions.push(
      this.voiceService.error$.subscribe((error: string) => {
        this.snackbar.error(`Voice recognition error: ${error}`);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private async processTranscript(transcript: string): Promise<void> {
    this.isProcessing.set(true);

    try {
      const command = this.commandService.parseCommand(transcript);

      if (command) {
        this.lastCommand.set(command);
        const success = await this.commandService.executeCommand(command);
        this.voiceService.logCommand(transcript, command.action, success);

        if (success) {
          // Close overlay after successful command
          setTimeout(() => {
            this.stopListening();
          }, 1500);
        }
      } else {
        this.snackbar.warning('Could not understand command. Try again.');
        this.voiceService.logCommand(transcript, null, false);
      }
    } catch (error) {
      console.error('Failed to process transcript:', error);
      this.snackbar.error('Failed to process voice command');
    } finally {
      this.isProcessing.set(false);
    }
  }

  stopListening(): void {
    this.voiceService.stopListening();
    this.currentTranscript.set('');
    this.lastCommand.set(null);
  }

  onOverlayClick(): void {
    this.stopListening();
  }

  showHelp(): void {
    const commands = this.commandService.getSupportedCommands();
    console.log('=== Voice Commands Help ===');
    commands.forEach(cmd => {
      console.log(`\n${cmd.pattern}: ${cmd.description}`);
      console.log('Examples:');
      cmd.examples.forEach(ex => console.log(`  - "${ex}"`));
    });
    this.snackbar.info('Voice commands list logged to console');
  }

  getCommandIcon(action: string): string {
    const icons: Record<string, string> = {
      navigate: 'navigation',
      add: 'add_circle',
      search: 'search',
      show: 'visibility',
      help: 'help',
    };
    return icons[action] || 'mic';
  }

  getCommandLabel(command: ParsedCommand): string {
    if (command.target) {
      return `${command.action} ${command.target.replace('-', ' ')}`;
    }
    return command.action;
  }
}
