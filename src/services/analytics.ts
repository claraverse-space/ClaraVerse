import posthog from 'posthog-js';
import Store from 'electron-store';
import os from 'os';

const store = new Store();
const CONSENT_KEY = 'analytics-consent';
const ANONYMOUS_ID_KEY = 'anonymous-id';

// List of test/internal user identifiers
const INTERNAL_USERS = [
  'localhost',
  '127.0.0.1',
  'development',
  'test',
  'staging'
];

class Analytics {
  private static instance: Analytics;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  public init() {
    if (this.initialized) return;
    
    const hasConsent = this.getConsent();
    if (hasConsent && !this.isInternalUser()) {
      this.setupPostHog();
    }
    
    this.initialized = true;
  }

  private isInternalUser(): boolean {
    const hostname = os.hostname().toLowerCase();
    return INTERNAL_USERS.some(internal => 
      hostname.includes(internal) || 
      process.env.NODE_ENV === 'development'
    );
  }

  private setupPostHog() {
    // Configure PostHog with minimal tracking
    posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
      persistence: 'localStorage',
      bootstrap: {
        distinctID: this.getAnonymousId(),
      },
      // Disable all automatic tracking
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      disable_persistence: false,
      // Disable personal data collection
      property_blacklist: [
        'ip',
        '$ip',
        '$current_url',
        '$browser',
        '$browser_version',
        '$device_id',
        '$user_id',
        '$initial_referrer',
        '$initial_referring_domain',
        '$referrer',
        '$referring_domain',
        '$host',
        '$pathname',
      ],
    });

    // Only track installation with OS details
    this.trackInstallation();
  }

  private getOSDetails() {
    return {
      os_name: os.type(),
      os_version: os.release(),
      os_platform: os.platform(),
    };
  }

  private trackInstallation() {
    // Only track if this is first time (new installation)
    const isTracked = store.get('installation_tracked');
    if (!isTracked) {
      posthog.capture('user_installed', {
        ...this.getOSDetails(),
        app_version: window.electron?.getAppVersion() || 'unknown',
      });
      store.set('installation_tracked', true);
    }
  }

  private getAnonymousId(): string {
    let id = store.get(ANONYMOUS_ID_KEY) as string;
    if (!id) {
      id = 'anon_' + Math.random().toString(36).substr(2, 9);
      store.set(ANONYMOUS_ID_KEY, id);
    }
    return id;
  }

  public setConsent(consent: boolean) {
    store.set(CONSENT_KEY, consent);
    if (consent && !this.initialized) {
      this.init();
    } else if (!consent) {
      posthog.opt_out_capturing();
    }
  }

  public getConsent(): boolean {
    return store.get(CONSENT_KEY, false) as boolean;
  }
}

export const analytics = Analytics.getInstance();

// Types for Electron bridge
declare global {
  interface Window {
    electron?: {
      getAppVersion: () => string;
      getElectronVersion: () => string;
      getPlatform: () => string;
      getOsVersion: () => string;
    };
  }
} 