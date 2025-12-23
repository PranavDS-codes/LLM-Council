'use client';

import { useCouncilStore } from '@/store/councilStore';
import { useEffect } from 'react';

export function ThemeSync() {
    const { theme } = useCouncilStore();

    useEffect(() => {
        // Determine the value for data-theme. 
        // Since our globals.css defines [data-theme='dark'], we set 'dark' or 'light'.
        // If 'light', the root variables apply by default, but explicit 'light' value is fine too.
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    return null;
}
