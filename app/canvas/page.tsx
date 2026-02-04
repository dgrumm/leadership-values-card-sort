  'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Step1Page } from '@/components/canvas/Step1Page';
import { Step2Page } from '@/components/canvas/Step2Page';
import { Step3Page } from '@/components/canvas/Step3Page';
import { EventDrivenSessionProvider, useEventPublisher } from '@/contexts/EventDrivenSessionContext';
import { useSessionStep1Store, useSessionStep2Store } from '@/hooks/stores/useSessionStores';

// StepRouter component that uses event-driven session-scoped hooks (must be inside provider)
function StepRouter({ 
  currentStep, 
  sessionData, 
  onStepChange 
}: { 
  currentStep: 1 | 2 | 3; 
  sessionData: { sessionCode: string; participantName: string }; 
  onStepChange: (step: 1 | 2 | 3) => void;
}) {
  const { moreImportantPile, lessImportantPile } = useSessionStep1Store();
  const { top8Pile, lessImportantPile: step2LessImportant, discardedPile: step2Discarded } = useSessionStep2Store();
  const { publishStepTransition } = useEventPublisher();
  
  // Expose session stores globally for E2E testing
  useEffect(() => {
    if (typeof window !== 'undefined' && (process.env.NODE_ENV === 'development' || process.env.PLAYWRIGHT_TEST === 'true')) {
      // Import and expose test utilities
      import('@/lib/test-utils/browser-globals').then(() => {
        const testWindow = window as typeof window & {
          useSessionStep1Store: typeof useSessionStep1Store;
          useSessionStep2Store: typeof useSessionStep2Store;
        };
        testWindow.useSessionStep1Store = useSessionStep1Store;
        testWindow.useSessionStep2Store = useSessionStep2Store;
        console.log('🧪 Session-scoped test utilities exposed for E2E testing');
      });
    }
  }, []);

  // Render appropriate step component
  if (currentStep === 1) {
    return (
      <Step1Page
        participantName={sessionData.participantName}
        sessionCode={sessionData.sessionCode}
        currentStep={currentStep}
        onStepComplete={async () => {
          // Publish step transition event before UI update
          console.log('🎯 [Step1→2] Starting step transition...');
          try {
            console.log('📤 [Step1→2] Publishing step transition event...');
            await publishStepTransition(1, 2);
            console.log('✅ [Step1→2] Published step transition event successfully');
          } catch (error) {
            console.error('❌ [Step1→2] Failed to publish step transition event:', error);
          }
          
          console.log('🔄 [Step1→2] Updating local UI state...');
          onStepChange(2);
          console.log('✅ [Step1→2] Local UI updated to Step 2');
        }}
      />
    );
  }

  if (currentStep === 2) {
    // If Step 1 data is empty, redirect back to Step 1 to complete it first
    if (moreImportantPile.length === 0 && lessImportantPile.length === 0) {
      return (
        <Step1Page
          participantName={sessionData.participantName}
          sessionCode={sessionData.sessionCode}
          onStepComplete={() => onStepChange(2)}
        />
      );
    }
    
    return (
      <Step2Page
        participantName={sessionData.participantName}
        sessionCode={sessionData.sessionCode}
        currentStep={currentStep}
        step1Data={{
          moreImportantPile,
          lessImportantPile
        }}
        onStepComplete={async () => {
          console.log('🎯 [Step2→3] Starting step transition...');
          try {
            console.log('📤 [Step2→3] Publishing step transition event...');
            await publishStepTransition(2, 3);
            console.log('✅ [Step2→3] Published step transition event successfully');
          } catch (error) {
            console.error('❌ [Step2→3] Failed to publish step transition event:', error);
          }
          
          console.log('🔄 [Step2→3] Updating local UI state...');
          onStepChange(3);
          console.log('✅ [Step2→3] Local UI updated to Step 3');
        }}
      />
    );
  }

  // Step 3 - Final selection of Top 3 values
  if (currentStep === 3) {
    // If Step 2 data is empty, redirect back to Step 2 to complete it first
    if (top8Pile.length === 0) {
      return (
        <Step2Page
          participantName={sessionData.participantName}
          sessionCode={sessionData.sessionCode}
          currentStep={currentStep}
          step1Data={{
            moreImportantPile,
            lessImportantPile
          }}
          onStepComplete={async () => {
            try {
              await publishStepTransition(2, 3);
              console.log('✅ Published step 2→3 transition event (from redirect)');
            } catch (error) {
              console.warn('⚠️ Failed to publish step transition, proceeding with local update:', error);
            }
            onStepChange(3);
          }}
        />
      );
    }
    
    return (
      <Step3Page
        participantName={sessionData.participantName}
        sessionCode={sessionData.sessionCode}
        currentStep={currentStep}
        step2Data={{
          top8Pile,
          lessImportantPile: step2LessImportant,
          discardedPile: step2Discarded
        }}
        step1Data={{
          lessImportantPile
        }}
        onStepComplete={() => {
          console.log('✅ Exercise completed! Final step reached.');
          // TODO: Navigate to results/review page
        }}
      />
    );
  }

  // Fallback - should never reach here
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Invalid Step</h1>
        <p className="text-gray-600">Please start from Step 1</p>
        <button 
          onClick={() => onStepChange(1)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Back to Step 1
        </button>
      </div>
    </div>
  );
}

export default function CanvasPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [sessionData, setSessionData] = useState<{
    sessionCode: string;
    participantName: string;
  } | null>(null);

  useEffect(() => {
    const sessionCode = searchParams.get('session');
    const participantName = searchParams.get('name');
    const step = searchParams.get('step');

    if (!sessionCode || !participantName) {
      // Redirect to login if missing session data
      router.replace('/');
      return;
    }

    setSessionData({
      sessionCode,
      participantName: decodeURIComponent(participantName)
    });
    
    // Set current step from URL or default to 1
    if (step === '2') {
      setCurrentStep(2);
    } else if (step === '3') {
      setCurrentStep(3);
    } else {
      setCurrentStep(1);
    }
    
    setIsLoading(false);
  }, [searchParams, router]);

  const handleStepNavigation = async (step: 1 | 2 | 3) => {
    try {
      // 1. Update local UI state immediately for responsiveness
      setCurrentStep(step);
      
      // 2. Update URL to reflect the current step
      const params = new URLSearchParams(searchParams);
      params.set('step', step.toString());
      router.replace(`/canvas?${params.toString()}`);
      
      console.log(`🎯 Local step navigation updated to step ${step}`);
      
      // Note: Step transition events are published by the step components
      // when onStepComplete is called, eliminating race conditions
    } catch (error) {
      console.error('❌ Failed to update step navigation:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
          <div className="h-32 w-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return null; // Will redirect to login
  }

  // Generate a stable participant ID using browser localStorage
  const participantId = (() => {
    // Sanitize participant name for use in ID (replace spaces and special chars with hyphens)
    const sanitizedName = sessionData.participantName.replace(/[^a-zA-Z0-9_-]/g, '-');
    
    if (typeof window === 'undefined') return `${sessionData.sessionCode}-${sanitizedName}`;
    
    const storageKey = `participant-id-${sessionData.sessionCode}-${sessionData.participantName}`;
    let storedId = localStorage.getItem(storageKey);
    
    if (!storedId) {
      // Generate new stable ID: sessionCode + sanitized name + timestamp + random
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      storedId = `${sessionData.sessionCode}-${sanitizedName}-${timestamp}-${random}`;
      localStorage.setItem(storageKey, storedId);
      console.log(`🆔 [ParticipantID] Generated new stable ID: ${storedId}`);
    } else {
      console.log(`🔄 [ParticipantID] Reusing existing stable ID: ${storedId}`);
    }
    
    return storedId;
  })();

  return (
    <EventDrivenSessionProvider 
      sessionCode={sessionData.sessionCode} 
      participantId={participantId}
      participantName={sessionData.participantName}
      config={{
        enableDebugLogging: process.env.NODE_ENV === 'development',
        enableMemoryTracking: process.env.NODE_ENV === 'development'
      }}
    >
      <StepRouter 
        currentStep={currentStep}
        sessionData={sessionData}
        onStepChange={handleStepNavigation}
      />
    </EventDrivenSessionProvider>
  );
}
