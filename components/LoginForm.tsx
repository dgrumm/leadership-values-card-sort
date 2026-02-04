'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SessionCodeInput } from '@/components/ui/SessionCodeInput';
import { useSessionStorage } from '@/hooks/useSessionStorage';
import { useFormValidation } from '@/hooks/useFormValidation';
import { useSessionJoin } from '@/hooks/useSessionJoin';
import { formatName } from '@/lib/utils/validation';

export function LoginForm() {
  const { data: storedData, updateField, isLoaded } = useSessionStorage();
  const [formData, setFormData] = useState({
    name: '',
    sessionCode: ''
  });
  
  const { validation, markInteracted, getFieldError, getFieldState, validateAll, resetValidationState } = useFormValidation({
    name: formData.name,
    sessionCode: formData.sessionCode
  });
  
  const { isLoading, error, isSuccess, joinOrCreateSession, clearError } = useSessionJoin();

  // Load stored data once available
  useEffect(() => {
    if (isLoaded) {
      setFormData(storedData);
    }
  }, [isLoaded, storedData]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatName(rawValue);
    setFormData(prev => ({ ...prev, name: formatted }));
    updateField('name', formatted);
    clearError();
  };

  const handleSessionCodeChange = (value: string) => {
    setFormData(prev => ({ ...prev, sessionCode: value }));
    updateField('sessionCode', value);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields (both name and session code required)
    const finalValidation = validateAll();
    if (!finalValidation.isFormValid) {
      return;
    }

    const { name, sessionCode } = formData;
    
    // Single intelligent join/create operation
    await joinOrCreateSession({
      name,
      sessionCode,
      onSuccess: () => {
        // No need to clear form data - user is being redirected away
        // The session storage can be useful if user returns to login page
      },
      onError: (error) => {
        // Only genuine errors (session full, network issues, etc.)
        console.warn('Join/create failed:', error);
        resetValidationState();
      }
    });
  };

  // Show loading state while session storage is loading
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">
          <Card className="w-full max-w-md">
            <CardContent>
              <div className="h-8 bg-gray-200 rounded mb-4"></div>
              <div className="h-10 bg-gray-200 rounded mb-4"></div>
              <div className="h-10 bg-gray-200 rounded mb-4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md" variant="elevated">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Welcome to Leadership Values
          </CardTitle>
          <p className="text-gray-600 mt-2">Cards Exercise</p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Your Name:"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleNameChange}
              onBlur={() => markInteracted('name')}
              placeholder="Enter your name"
              error={isSuccess ? undefined : getFieldError('name')}
              validationState={isSuccess ? 'neutral' : getFieldState('name')}
              maxLength={50}
              required
              autoComplete="given-name"
              data-testid="name-input"
            />

            <SessionCodeInput
              value={formData.sessionCode}
              onChange={handleSessionCodeChange}
              onBlur={() => markInteracted('sessionCode')}
              error={isSuccess ? undefined : getFieldError('sessionCode')}
              validationState={isSuccess ? 'neutral' : getFieldState('sessionCode')}
              disabled={isLoading}
            />

            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200" data-testid="error-message">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              loadingText={isSuccess ? "Success! Redirecting..." : "Joining Session..."}
              disabled={!validation.isFormValid || isLoading}
              data-testid="create-session-button"
            >
              {isSuccess ? "✓ Success!" : "Join Session ➜"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
