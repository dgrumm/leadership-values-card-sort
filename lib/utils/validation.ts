/**
 * Input validation utilities for login form
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate participant name
 * - 1-50 characters
 * - Alphanumeric + spaces + hyphens
 * - Trim whitespace
 */
export function validateName(name: string): ValidationResult {
  const trimmedName = name.trim();
  
  if (trimmedName.length === 0) {
    return { isValid: false, error: 'Please enter your name' };
  }
  
  if (trimmedName.length > 50) {
    return { isValid: false, error: 'Name must be 50 characters or less' };
  }
  
  // Allow alphanumeric, spaces, hyphens, and common punctuation
  const validNamePattern = /^[a-zA-Z0-9 \-'\.]+$/;
  if (!validNamePattern.test(trimmedName)) {
    return { isValid: false, error: 'Name can only contain letters, numbers, spaces, and hyphens' };
  }
  
  return { isValid: true };
}

/**
 * Validate session code
 * - Exactly 6 characters
 * - Alphanumeric only (A-Z, 0-9)
 * - Auto-uppercase
 */
export function validateSessionCode(code: string): ValidationResult {
  const upperCode = code.toUpperCase().trim();
  
  if (upperCode.length === 0) {
    return { isValid: false, error: 'Please enter a session code' };
  }
  
  if (upperCode.length !== 6) {
    return { isValid: false, error: 'Session code must be exactly 6 characters' };
  }
  
  const validCodePattern = /^[A-Z0-9]{6}$/;
  if (!validCodePattern.test(upperCode)) {
    return { isValid: false, error: 'Session code must contain only letters and numbers' };
  }
  
  return { isValid: true };
}

/**
 * Format session code as user types
 * - Convert to uppercase
 * - Remove invalid characters
 * - Limit to 6 characters
 */
export function formatSessionCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

/**
 * Format participant name as user types
 * - Trim leading/trailing whitespace
 * - Limit to 50 characters
 * - Remove invalid characters
 */
export function formatName(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9 \-'\.]/g, '')
    .slice(0, 50);
}
