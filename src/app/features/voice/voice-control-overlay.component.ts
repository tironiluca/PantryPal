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
  templateUrl: './voice-control-overlay.component.html',
  styleUrls: ['./voice-control-overlay.component.scss'],
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
