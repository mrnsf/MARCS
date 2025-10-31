// PWA utilities for service worker registration and management

export interface PWAInstallPrompt {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAStatus {
  isInstalled: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  isOnline: boolean;
  swRegistered: boolean;
  swActive: boolean;
}

class PWAManager {
  private installPrompt: PWAInstallPrompt | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private statusCallbacks: ((status: PWAStatus) => void)[] = [];

  constructor() {
    this.init();
  }

  private async init() {
    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e as any;
      this.notifyStatusChange();
    });

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      this.installPrompt = null;
      this.notifyStatusChange();
    });

    // Listen for online/offline changes
    window.addEventListener('online', () => this.notifyStatusChange());
    window.addEventListener('offline', () => this.notifyStatusChange());

    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', this.swRegistration);
        
        // Listen for service worker updates
        this.swRegistration.addEventListener('updatefound', () => {
          const newWorker = this.swRegistration!.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker is available
                this.notifyUpdate();
              }
            });
          }
        });

        this.notifyStatusChange();
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  public async installApp(): Promise<boolean> {
    if (!this.installPrompt) {
      return false;
    }

    try {
      await this.installPrompt.prompt();
      const choice = await this.installPrompt.userChoice;
      
      if (choice.outcome === 'accepted') {
        this.installPrompt = null;
        this.notifyStatusChange();
        return true;
      }
      return false;
    } catch (error) {
      console.error('App installation failed:', error);
      return false;
    }
  }

  public getStatus(): PWAStatus {
    return {
      isInstalled: this.isInstalled(),
      isStandalone: this.isStandalone(),
      canInstall: !!this.installPrompt,
      isOnline: navigator.onLine,
      swRegistered: !!this.swRegistration,
      swActive: !!this.swRegistration?.active
    };
  }

  public onStatusChange(callback: (status: PWAStatus) => void) {
    this.statusCallbacks.push(callback);
    // Immediately call with current status
    callback(this.getStatus());
  }

  public offStatusChange(callback: (status: PWAStatus) => void) {
    const index = this.statusCallbacks.indexOf(callback);
    if (index > -1) {
      this.statusCallbacks.splice(index, 1);
    }
  }

  public async getCacheStatus(): Promise<{
    static: number;
    models: number;
    runtime: number;
    total: number;
  }> {
    if (!this.swRegistration?.active) {
      return { static: 0, models: 0, runtime: 0, total: 0 };
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_STATUS') {
          resolve(event.data);
        }
      };

      this.swRegistration!.active!.postMessage(
        { type: 'GET_CACHE_STATUS' },
        [messageChannel.port2]
      );
    });
  }

  public async updateServiceWorker(): Promise<void> {
    if (this.swRegistration) {
      await this.swRegistration.update();
    }
  }

  public async skipWaiting(): Promise<void> {
    if (this.swRegistration?.waiting) {
      this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  private isInstalled(): boolean {
    // Check if app is installed (various methods)
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  }

  private isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches;
  }

  private notifyStatusChange() {
    const status = this.getStatus();
    this.statusCallbacks.forEach(callback => callback(status));
  }

  private notifyUpdate() {
    // Dispatch custom event for service worker update
    window.dispatchEvent(new CustomEvent('swUpdate', {
      detail: { registration: this.swRegistration }
    }));
  }
}

// Singleton instance
export const pwaManager = new PWAManager();

// Utility functions
export const isPWAInstalled = () => pwaManager.getStatus().isInstalled;
export const canInstallPWA = () => pwaManager.getStatus().canInstall;
export const installPWA = () => pwaManager.installApp();

// React hook for PWA status
export function usePWAStatus() {
  const [status, setStatus] = React.useState<PWAStatus>(pwaManager.getStatus());

  React.useEffect(() => {
    pwaManager.onStatusChange(setStatus);
    return () => pwaManager.offStatusChange(setStatus);
  }, []);

  return {
    ...status,
    install: pwaManager.installApp.bind(pwaManager),
    updateSW: pwaManager.updateServiceWorker.bind(pwaManager),
    getCacheStatus: pwaManager.getCacheStatus.bind(pwaManager)
  };
}

// Add React import for the hook
import React from 'react';