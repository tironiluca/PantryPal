import { Injectable } from '@angular/core';
import { SnackbarService } from './snackbar.service';

@Injectable({ providedIn: 'root' })
export class ErrorHandlerService {
  constructor(private snackbar: SnackbarService) {}

  /**
   * Handle errors and show user-friendly messages
   * @param error The error object
   * @param context Optional context string for logging
   */
  handle(error: any, context?: string): void {
    const errorContext = context ? `[${context}]` : '';
    console.error(errorContext, error);

    const message = this.extractMessage(error);
    this.snackbar.error(message);
  }

  /**
   * Handle errors with custom user message
   * @param error The error object
   * @param userMessage Custom message to show to user
   * @param context Optional context for logging
   */
  handleWithMessage(error: any, userMessage: string, context?: string): void {
    const errorContext = context ? `[${context}]` : '';
    console.error(errorContext, error);
    this.snackbar.error(userMessage);
  }

  /**
   * Extract user-friendly message from error
   */
  private extractMessage(error: any): string {
    // String error
    if (typeof error === 'string') {
      return error;
    }

    // HTTP error response
    if (error?.error?.message) {
      return error.error.message;
    }

    // Standard error object
    if (error?.message) {
      return error.message;
    }

    // HTTP status text
    if (error?.statusText) {
      return error.statusText;
    }

    // Fallback
    return 'An unexpected error occurred. Please try again.';
  }

  /**
   * Log info message (for debugging)
   */
  logInfo(message: string, context?: string): void {
    const logContext = context ? `[${context}]` : '';
    console.log(logContext, message);
  }

  /**
   * Log warning message
   */
  logWarning(message: string, context?: string): void {
    const logContext = context ? `[${context}]` : '';
    console.warn(logContext, message);
  }
}
