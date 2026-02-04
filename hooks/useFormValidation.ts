'use client';

import { useState, useEffect, useMemo } from 'react';
import { validateName, validateSessionCode, ValidationResult } from '@/lib/utils/validation';

export interface FormValidation {
  name: ValidationResult;
  sessionCode: ValidationResult;
  isFormValid: boolean;
}

export interface UseFormValidationProps {
  name: string;
  sessionCode: string;
  realTimeValidation?: boolean;
}

/**
 * Custom hook for real-time form validation
 */
export function useFormValidation({ 
  name, 
  sessionCode, 
  realTimeValidation = true 
}: UseFormValidationProps) {
  const [validation, setValidation] = useState<FormValidation>({
    name: { isValid: true },
    sessionCode: { isValid: true },
    isFormValid: false
  });

  const [hasInteracted, setHasInteracted] = useState({
    name: false,
    sessionCode: false
  });

  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // Debounced validation to improve performance with proper cleanup
  const debouncedValidation = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    
    const debounced = (currentName: string, currentSessionCode: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const nameValidation = validateName(currentName);
        const sessionCodeValidation = validateSessionCode(currentSessionCode);
        
        const newValidation: FormValidation = {
          name: nameValidation,
          sessionCode: sessionCodeValidation,
          isFormValid: nameValidation.isValid && sessionCodeValidation.isValid
        };

        setValidation(newValidation);
      }, 200); // Reduced to 200ms for better responsiveness
    };

    // Return debounced function with cleanup method
    debounced.cleanup = () => clearTimeout(timeoutId);
    return debounced;
  }, []);

  // Validate form whenever inputs change (debounced) with cleanup
  useEffect(() => {
    if (realTimeValidation) {
      debouncedValidation(name, sessionCode);
    } else {
      // Immediate validation when not in real-time mode
      const nameValidation = validateName(name);
      const sessionCodeValidation = validateSessionCode(sessionCode);
      
      const newValidation: FormValidation = {
        name: nameValidation,
        sessionCode: sessionCodeValidation,
        isFormValid: nameValidation.isValid && sessionCodeValidation.isValid
      };

      setValidation(newValidation);
    }

    // Cleanup debounced timeouts on unmount or when dependencies change
    return () => {
      if (debouncedValidation.cleanup) {
        debouncedValidation.cleanup();
      }
    };
  }, [name, sessionCode, debouncedValidation, realTimeValidation]);

  // Mark field as interacted with for validation display
  const markInteracted = (field: 'name' | 'sessionCode') => {
    setHasInteracted(prev => ({ ...prev, [field]: true }));
  };

  // Get validation error to display (only show if field has been interacted with)
  const getFieldError = (field: 'name' | 'sessionCode'): string | undefined => {
    if (!realTimeValidation || !hasInteracted[field] || isSubmittingForm) {
      return undefined;
    }
    
    return validation[field].error;
  };

  // Get field validation state for styling
  const getFieldState = (field: 'name' | 'sessionCode'): 'valid' | 'invalid' | 'neutral' => {
    if (!hasInteracted[field] || isSubmittingForm) {
      return 'neutral';
    }
    
    return validation[field].isValid ? 'valid' : 'invalid';
  };

  // Force validation of all fields (for form submission)
  const validateAll = (): FormValidation => {
    // Set submitting flag to suppress error display
    setIsSubmittingForm(true);
    
    // Calculate fresh validation without setting hasInteracted
    const nameValidation = validateName(name);
    const sessionCodeValidation = validateSessionCode(sessionCode);
    
    const freshValidation: FormValidation = {
      name: nameValidation,
      sessionCode: sessionCodeValidation,
      isFormValid: nameValidation.isValid && sessionCodeValidation.isValid
    };

    // Only mark as interacted if validation fails (to show errors)
    if (!freshValidation.isFormValid) {
      setHasInteracted({ name: true, sessionCode: true });
      setIsSubmittingForm(false); // Allow errors to show for failed validation
    }

    return freshValidation;
  };

  // Method to clear submission state (called after successful submission)
  const clearSubmissionState = () => {
    setIsSubmittingForm(false);
  };

  // Method to reset all validation state (called on successful form submission)
  const resetValidationState = () => {
    setIsSubmittingForm(false);
    setHasInteracted({ name: false, sessionCode: false });
    setValidation({
      name: { isValid: true },
      sessionCode: { isValid: true },
      isFormValid: false
    });
  };

  return {
    validation,
    markInteracted,
    getFieldError,
    getFieldState,
    validateAll,
    clearSubmissionState,
    resetValidationState,
    hasInteracted
  };
}
