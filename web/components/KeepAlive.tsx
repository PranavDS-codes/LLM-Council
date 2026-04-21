'use client';

import { useEffect } from 'react';

import { getApiUrl } from '@/lib/api';

const PING_INTERVAL_MS = 14 * 60 * 1000;

export function KeepAlive() {
  useEffect(() => {
    const ping = () => {
      fetch(getApiUrl('/health')).catch(() => undefined);
    };

    ping();
    const intervalId = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);

  return null;
}
