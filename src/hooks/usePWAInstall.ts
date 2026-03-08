import { useState, useEffect, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type AndroidBrowser = 'chrome' | 'samsung' | 'firefox' | 'other';

function detectAndroidBrowser(): AndroidBrowser {
  const ua = navigator.userAgent;
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Firefox/i.test(ua)) return 'firefox';
  if (/Chrome/i.test(ua)) return 'chrome';
  return 'other';
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [androidBrowser, setAndroidBrowser] = useState<AndroidBrowser>('other');
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isiOS && !isStandalone);

    const android = /Android/i.test(ua);
    setIsAndroid(android && !isStandalone);
    if (android) setAndroidBrowser(detectAndroidBrowser());

    const mobile = isiOS || android;
    setIsMobile(mobile);

    const handler = (e: Event) => {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(evt);
      promptRef.current = evt;
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      promptRef.current = null;
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const waitForPrompt = useCallback((): Promise<BeforeInstallPromptEvent | null> => {
    if (promptRef.current) return Promise.resolve(promptRef.current);
    return new Promise((resolve) => {
      const onEvent = (e: Event) => {
        e.preventDefault();
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', onEvent);
        const evt = e as BeforeInstallPromptEvent;
        setDeferredPrompt(evt);
        promptRef.current = evt;
        resolve(evt);
      };
      const timer = setTimeout(() => {
        window.removeEventListener('beforeinstallprompt', onEvent);
        resolve(null);
      }, 3000);
      window.addEventListener('beforeinstallprompt', onEvent);
    });
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'ios' | 'android' | 'unsupported'> => {
    // Try existing prompt first
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        promptRef.current = null;
      }
      return outcome;
    }

    // On Android, wait briefly for the event
    if (isAndroid) {
      const prompt = await waitForPrompt();
      if (prompt) {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          promptRef.current = null;
        }
        return outcome;
      }
      return 'android';
    }

    if (isIOS) return 'ios';
    return 'unsupported';
  }, [deferredPrompt, isIOS, isAndroid, waitForPrompt]);

  const canInstall = !isInstalled && (!!deferredPrompt || isIOS || isAndroid);

  return { canInstall, isIOS, isAndroid, isMobile, isInstalled, promptInstall, androidBrowser };
}
