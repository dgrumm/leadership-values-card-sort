import { 
  SESSION_CODE_PATTERN, 
  PARTICIPANT_NAME_MIN_LENGTH, 
  PARTICIPANT_NAME_MAX_LENGTH 
} from '../constants';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface SessionValidationErrors {
  INVALID_SESSION_CODE: string;
  SESSION_NOT_FOUND: string;
  SESSION_EXPIRED: string;
  SESSION_FULL: string;
  INVALID_PARTICIPANT_NAME: string;
  DUPLICATE_PARTICIPANT_NAME: string;
  CONNECTION_LOST: string;
}

export const SESSION_VALIDATION_ERRORS: SessionValidationErrors = {
  INVALID_SESSION_CODE: 'Session code must be exactly 6 alphanumeric characters',
  SESSION_NOT_FOUND: 'Session not found. Check the code or start a new session.',
  SESSION_EXPIRED: 'This session has ended. Start a new session?',
  SESSION_FULL: 'Session is full (50 participants max). Try another code.',
  INVALID_PARTICIPANT_NAME: 'Name must be 1-50 characters, alphanumeric characters, spaces, and hyphens only',
  DUPLICATE_PARTICIPANT_NAME: 'This name is already taken in this session',
  CONNECTION_LOST: 'Connection lost. Attempting to reconnect...'
};

export function validateSessionCode(sessionCode: string): ValidationResult {
  if (!sessionCode) {
    return { isValid: false, error: SESSION_VALIDATION_ERRORS.INVALID_SESSION_CODE };
  }
  
  if (!SESSION_CODE_PATTERN.test(sessionCode)) {
    return { isValid: false, error: SESSION_VALIDATION_ERRORS.INVALID_SESSION_CODE };
  }
  
  return { isValid: true };
}

export function validateParticipantName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: SESSION_VALIDATION_ERRORS.INVALID_PARTICIPANT_NAME };
  }
  
  // Check for HTML tags BEFORE sanitization (basic XSS prevention)
  if (/<[^>]*>/.test(name)) {
    return { isValid: false, error: 'Name cannot contain HTML tags' };
  }
  
  // Check for potentially dangerous characters BEFORE sanitization
  // Note: Allow apostrophes (') for names like O'Brien - removed from blocked chars
  if (/[<>"&\\]/.test(name)) {
    return { isValid: false, error: 'Name contains invalid characters' };
  }
  
  const sanitized = sanitizeParticipantName(name);
  
  if (sanitized.length < PARTICIPANT_NAME_MIN_LENGTH) {
    return { isValid: false, error: 'Name must be at least 1 character long' };
  }
  
  if (sanitized.length > PARTICIPANT_NAME_MAX_LENGTH) {
    return { isValid: false, error: `Name must be less than ${PARTICIPANT_NAME_MAX_LENGTH} characters` };
  }
  
  // Allow alphanumeric, spaces, hyphens, underscores, apostrophes, and basic punctuation
  const namePattern = /^[a-zA-Z0-9 \-_'.!?(),]+$/;
  if (!namePattern.test(sanitized)) {
    return { isValid: false, error: SESSION_VALIDATION_ERRORS.INVALID_PARTICIPANT_NAME };
  }
  
  return { isValid: true };
}

export function resolveNameConflict(desiredName: string, existingNames: Set<string>): string {
  if (!existingNames.has(desiredName)) {
    return desiredName;
  }
  
  // Try appending numbers: John -> John-2 -> John-3, etc.
  let counter = 2;
  let resolvedName: string;
  
  do {
    resolvedName = `${desiredName}-${counter}`;
    counter++;
  } while (existingNames.has(resolvedName) && counter <= 100); // Prevent infinite loops
  
  if (counter > 100) {
    // Fallback to timestamp-based suffix
    const timestamp = Date.now().toString().slice(-4);
    resolvedName = `${desiredName}-${timestamp}`;
  }
  
  return resolvedName;
}

export function sanitizeParticipantName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }
  
  // Basic HTML entity decoding for common cases
  let sanitized = name
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Remove control characters and non-printable characters
  sanitized = sanitized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  
  // Trim whitespace and normalize multiple spaces to single space
  sanitized = sanitized.trim().replace(/\s+/g, ' ');
  
  // Remove leading/trailing punctuation that could be problematic
  sanitized = sanitized.replace(/^[^\w\s]+|[^\w\s]+$/g, '');
  
  return sanitized;
}

// Additional utility for sanitizing session codes
export function sanitizeSessionCode(code: string): string {
  if (!code || typeof code !== 'string') {
    return '';
  }
  
  // Remove any non-alphanumeric characters and convert to uppercase
  return code.replace(/[^A-Z0-9]/gi, '').toUpperCase().substring(0, 6);
}

// Sanitize generic text input
export function sanitizeTextInput(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>'"&\\]/g, '');
  
  // Remove control characters
  sanitized = sanitized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  
  // Trim and limit length
  sanitized = sanitized.trim().substring(0, maxLength);
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  return sanitized;
}
