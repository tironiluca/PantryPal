import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DbService } from './db.service';
import { SnackbarService } from './snackbar.service';

export interface ParsedCommand {
  action: string;
  target?: string;
  params?: Record<string, any>;
  confidence: number;
}

@Injectable({
  providedIn: 'root',
})
export class VoiceCommandService {
  private router = inject(Router);
  private db = inject(DbService);
  private snackbar = inject(SnackbarService);

  /**
   * Parse a voice transcript into a structured command
   */
  parseCommand(transcript: string): ParsedCommand | null {
    const normalized = transcript.toLowerCase().trim();

    // Navigation commands
    if (this.matchesPattern(normalized, ['go to', 'navigate to', 'open', 'show'])) {
      return this.parseNavigationCommand(normalized);
    }

    // Add commands
    if (this.matchesPattern(normalized, ['add', 'create', 'new'])) {
      return this.parseAddCommand(normalized);
    }

    // Search commands
    if (this.matchesPattern(normalized, ['search', 'find', 'look for'])) {
      return this.parseSearchCommand(normalized);
    }

    // Show/Display commands
    if (this.matchesPattern(normalized, ['show me', 'display', 'list'])) {
      return this.parseShowCommand(normalized);
    }

    // Help command
    if (this.matchesPattern(normalized, ['help', 'what can you do', 'commands'])) {
      return {
        action: 'help',
        confidence: 0.9,
      };
    }

    return null;
  }

  /**
   * Execute a parsed command
   */
  async executeCommand(command: ParsedCommand): Promise<boolean> {
    try {
      switch (command.action) {
        case 'navigate':
          return await this.executeNavigation(command.target!);

        case 'add':
          return await this.executeAdd(command.target!, command.params);

        case 'search':
          return await this.executeSearch(command.target!, command.params);

        case 'show':
          return await this.executeShow(command.target!);

        case 'help':
          this.showHelp();
          return true;

        default:
          this.snackbar.warning(`Unknown command: ${command.action}`);
          return false;
      }
    } catch (error) {
      console.error('Failed to execute command:', error);
      this.snackbar.error('Failed to execute voice command');
      return false;
    }
  }

  /**
   * Get list of supported commands
   */
  getSupportedCommands(): Array<{ pattern: string; description: string; examples: string[] }> {
    return [
      {
        pattern: 'Navigate',
        description: 'Navigate to different sections of the app',
        examples: [
          'Go to inventory',
          'Open recipes',
          'Show meal plan',
          'Navigate to settings',
        ],
      },
      {
        pattern: 'Add',
        description: 'Add new items',
        examples: [
          'Add ingredient',
          'Create recipe',
          'Add inventory item',
        ],
      },
      {
        pattern: 'Search',
        description: 'Search for items',
        examples: [
          'Search for milk',
          'Find recipe pasta',
          'Look for tomatoes',
        ],
      },
      {
        pattern: 'Show',
        description: 'Display lists and information',
        examples: [
          'Show recipes',
          'Display inventory',
          'List ingredients',
        ],
      },
      {
        pattern: 'Help',
        description: 'Get help with voice commands',
        examples: [
          'Help',
          'What can you do',
          'Show commands',
        ],
      },
    ];
  }

  // Private helper methods

  private matchesPattern(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern));
  }

  private parseNavigationCommand(text: string): ParsedCommand {
    const targets = ['inventory', 'recipes', 'ingredients', 'meal plan', 'cart', 'settings', 'nutrition', 'home'];
    const target = targets.find(t => text.includes(t));

    if (target) {
      return {
        action: 'navigate',
        target: target === 'meal plan' ? 'meal-plan' : target,
        confidence: 0.9,
      };
    }

    return {
      action: 'navigate',
      target: 'home',
      confidence: 0.5,
    };
  }

  private parseAddCommand(text: string): ParsedCommand {
    if (text.includes('ingredient')) {
      return {
        action: 'add',
        target: 'ingredient',
        confidence: 0.85,
      };
    }

    if (text.includes('recipe')) {
      return {
        action: 'add',
        target: 'recipe',
        confidence: 0.85,
      };
    }

    if (text.includes('inventory') || text.includes('item')) {
      return {
        action: 'add',
        target: 'inventory',
        confidence: 0.85,
      };
    }

    if (text.includes('meal')) {
      return {
        action: 'add',
        target: 'meal-plan',
        confidence: 0.8,
      };
    }

    // Default to inventory if unclear
    return {
      action: 'add',
      target: 'inventory',
      confidence: 0.5,
    };
  }

  private parseSearchCommand(text: string): ParsedCommand {
    // Extract search query after the search keyword
    const searchKeywords = ['search for', 'find', 'look for'];
    let query = text;

    for (const keyword of searchKeywords) {
      if (text.includes(keyword)) {
        query = text.split(keyword)[1].trim();
        break;
      }
    }

    // Determine search target
    let target = 'inventory';
    if (text.includes('recipe')) {
      target = 'recipes';
    } else if (text.includes('ingredient')) {
      target = 'ingredients';
    }

    return {
      action: 'search',
      target,
      params: { query },
      confidence: query.length > 0 ? 0.8 : 0.3,
    };
  }

  private parseShowCommand(text: string): ParsedCommand {
    const targets = ['recipes', 'inventory', 'ingredients', 'meal plan', 'cart'];
    const target = targets.find(t => text.includes(t));

    return {
      action: 'show',
      target: target || 'inventory',
      confidence: target ? 0.85 : 0.5,
    };
  }

  private async executeNavigation(target: string): Promise<boolean> {
    const routeMap: Record<string, string> = {
      'inventory': '/home/inventory',
      'recipes': '/home/recipes',
      'ingredients': '/home/ingredients',
      'meal-plan': '/home/meal-plan',
      'cart': '/home/cart',
      'settings': '/home/settings',
      'nutrition': '/home/nutrition',
      'home': '/home',
    };

    const route = routeMap[target];
    if (route) {
      await this.router.navigate([route]);
      this.snackbar.success(`Navigated to ${target.replace('-', ' ')}`);
      return true;
    }

    this.snackbar.warning(`Unknown navigation target: ${target}`);
    return false;
  }

  private async executeAdd(target: string, params?: Record<string, any>): Promise<boolean> {
    await this.executeNavigation(target === 'meal-plan' ? 'meal-plan' : target);
    this.snackbar.info(`Opening add ${target.replace('-', ' ')} dialog...`);
    // The actual dialog opening would be handled by the respective components
    // This is just navigation + notification
    return true;
  }

  private async executeSearch(target: string, params?: Record<string, any>): Promise<boolean> {
    const query = params?.query || '';

    await this.executeNavigation(target);

    if (query) {
      this.snackbar.success(`Searching for "${query}" in ${target}`);
      // The actual search would be handled by the component
      // This is a signal to trigger search
    } else {
      this.snackbar.warning('No search query provided');
      return false;
    }

    return true;
  }

  private async executeShow(target: string): Promise<boolean> {
    return await this.executeNavigation(target);
  }

  private showHelp(): void {
    const commands = this.getSupportedCommands();
    const message = commands.map(cmd =>
      `${cmd.pattern}: ${cmd.description}\nExample: "${cmd.examples[0]}"`
    ).join('\n\n');

    // Show help in a more user-friendly way
    this.snackbar.info('Voice commands available. Check console for details.');
    console.log('=== Voice Commands Help ===\n\n' + message);
  }
}
