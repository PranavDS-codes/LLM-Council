'use client';

import { useEffect } from 'react';

const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

export function KeepAlive() {
    useEffect(() => {
        // Initial ping
        const ping = () => {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            // Debug log less intrusive for prod
            console.debug(`[Heartbeat] Pinging ${baseUrl}/health`);

            fetch(`${baseUrl}/health`)
                .catch(err => console.debug('KeepAlive ping failed:', err));
        };

        // Ping immediately on mount
        ping();

        // Set interval
        const intervalId = setInterval(ping, PING_INTERVAL_MS);

        // Clean up
        return () => clearInterval(intervalId);
    }, []);

    return null; // Render nothing
}
