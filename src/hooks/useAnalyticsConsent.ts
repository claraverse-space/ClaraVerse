import { useState, useEffect } from 'react';
import posthog from 'posthog-js';

const CONSENT_KEY = 'analytics-consent';

export const useAnalyticsConsent = () => {
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have stored consent
    const storedConsent = localStorage.getItem(CONSENT_KEY);
    if (storedConsent === null) {
      setShowConsentDialog(true);
    } else {
      setHasConsent(storedConsent === 'true');
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'true');
    setHasConsent(true);
    setShowConsentDialog(false);
    
    // Enable PostHog tracking
    posthog.opt_in_capturing();
    
    // Track the consent event
    posthog.capture('analytics_consent_given', {
      consent: true,
      timestamp: new Date().toISOString(),
    });
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'false');
    setHasConsent(false);
    setShowConsentDialog(false);
    
    // Disable PostHog tracking
    posthog.opt_out_capturing();
  };

  return {
    showConsentDialog,
    hasConsent,
    handleAccept,
    handleDecline,
  };
}; 