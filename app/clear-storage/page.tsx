'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function ClearStoragePage() {
  const [storageItems, setStorageItems] = useState<Array<{ key: string; value: string }>>([]);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    loadStorageItems();
  }, []);

  const loadStorageItems = () => {
    if (typeof window === 'undefined') return;
    
    const items: Array<{ key: string; value: string }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('participant-id-')) {
        const value = localStorage.getItem(key) || '';
        items.push({ key, value });
      }
    }
    setStorageItems(items);
  };

  const clearParticipantIds = () => {
    if (typeof window === 'undefined') return;
    
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('participant-id-')) {
        keys.push(key);
      }
    }
    
    keys.forEach(key => localStorage.removeItem(key));
    setCleared(true);
    setStorageItems([]);
    
    console.log(`Cleared ${keys.length} participant ID(s) from localStorage`);
  };

  const clearAllStorage = () => {
    if (typeof window === 'undefined') return;
    localStorage.clear();
    setCleared(true);
    setStorageItems([]);
    console.log('Cleared all localStorage');
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Clear Storage Debug Page</h1>
        
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Participant IDs in localStorage</h2>
            <p className="text-muted-foreground">
              Found {storageItems.length} participant ID(s)
            </p>
          </div>

          {storageItems.length > 0 ? (
            <div className="space-y-2">
              {storageItems.map(({ key, value }) => {
                const hasSpace = /\s/.test(value);
                const isInvalid = /[^a-zA-Z0-9_-]/.test(value);
                
                return (
                  <div 
                    key={key} 
                    className={`p-3 rounded border ${isInvalid ? 'border-red-500 bg-red-50' : 'border-border'}`}
                  >
                    <div className="text-sm font-mono break-all">
                      <div className="text-muted-foreground">Key: {key}</div>
                      <div className="mt-1">
                        Value: {value}
                        {hasSpace && <span className="ml-2 text-red-600 font-bold">(HAS SPACE!)</span>}
                        {isInvalid && <span className="ml-2 text-red-600 font-bold">(INVALID CHARS!)</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">No participant IDs found in localStorage</p>
          )}

          {cleared && (
            <div className="p-4 bg-green-50 text-green-800 rounded border border-green-200">
              Storage cleared successfully! Refresh the page to verify.
            </div>
          )}

          <div className="flex gap-4">
            <Button onClick={clearParticipantIds} variant="destructive">
              Clear Participant IDs Only
            </Button>
            <Button onClick={clearAllStorage} variant="outline">
              Clear ALL localStorage
            </Button>
            <Button onClick={loadStorageItems} variant="secondary">
              Refresh List
            </Button>
          </div>

          <div className="pt-4 border-t">
            <Button onClick={() => window.location.href = '/'} variant="default">
              Go to Login Page
            </Button>
          </div>
        </Card>

        <Card className="p-6 space-y-2">
          <h2 className="text-xl font-semibold">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Click "Clear Participant IDs Only" to remove cached participant IDs</li>
            <li>Click "Refresh List" to check if they were cleared</li>
            <li>Go back to the login page and try with a name that has spaces (e.g., "Dave G")</li>
            <li>If still having issues, use "Clear ALL localStorage" for a complete reset</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
