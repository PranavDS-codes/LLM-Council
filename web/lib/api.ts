import { useCouncilStore } from '@/store/councilStore';

// web/app/page.tsx (or wherever your API call is)

// 1. Try to get the URL from the environment (Vercel sets this)
// 2. If it's missing (like on your laptop), fall back to localhost
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Construct the final endpoint
const API_URL = `${BASE_URL}/api/summon`;

export async function summonCouncil(query: string, selectedAgents: string[]) {
    const store = useCouncilStore.getState();
    store.resetAll();
    store.setQuery(query);
    useCouncilStore.setState({ isProcessing: true, activePhase: 1 });

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, selected_agents: selectedAgents }),
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        if (!response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || ''; // Keep partial event in buffer

            for (const block of lines) {
                if (!block.trim()) continue;

                const eventLine = block.match(/^event: (.*)$/m);
                const dataLine = block.match(/^data: (.*)$/m);

                if (eventLine && dataLine) {
                    const eventType = eventLine[1].trim();
                    const dataStr = dataLine[1].trim();

                    try {
                        // Handle simple "DONE" or empty data gracefully
                        const data = dataStr ? JSON.parse(dataStr) : {};
                        handleEvent(eventType, data);
                    } catch (e) {
                        console.error('JSON Parse Error', e, dataStr);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Stream Error:', error);
        store.addMessage(`System Error: ${error}`);
    } finally {
        useCouncilStore.setState({ isProcessing: false });
    }
}

function handleEvent(type: string, data: any) {
    const store = useCouncilStore.getState();

    switch (type) {
        case 'generator_start':
            store.addMessage(`[System] Initializing ${data.agent}...`);
            break;
        case 'generator_chunk':
            store.appendToGenerator(data.agent, data.chunk);
            break;
        case 'critic_result':
            store.setCriticData(data);
            store.addMessage('[System] Critic has spoken.');
            break;
        case 'architect_result':
            store.setArchitectData(data);
            store.addMessage('[System] Architecture blueprint ready.');
            break;
        case 'finalizer_chunk':
            store.appendToFinalizer(data.chunk);
            break;
        case 'error':
            store.addMessage(`[Error] ${data.message}`);
            break;
        case 'done':
            store.addMessage('[System] Session Complete.');
            useCouncilStore.setState({ isProcessing: false });
            store.saveCurrentSession();
            break;
    }
}
