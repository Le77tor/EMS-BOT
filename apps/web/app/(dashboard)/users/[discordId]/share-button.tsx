'use client';

import { Button } from '@/components/ui/button';
import { Share2, Check } from 'lucide-react';
import { useState } from 'react';

export function ShareButton({ discordId }: { discordId: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const profileUrl = `${window.location.origin}/users/${discordId}`;
    
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Button 
      variant="outline" 
      className="gap-2"
      onClick={handleShare}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          Скопировано!
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          Поделиться
        </>
      )}
    </Button>
  );
}
