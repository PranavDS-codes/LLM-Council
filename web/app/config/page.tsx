'use client';

import { useState, useEffect } from 'react';
import { useCouncilStore } from '@/store/councilStore';
import { Check, X, Shield, Cpu, Key, RefreshCcw, AlertTriangle, Loader2, Save } from 'lucide-react';

interface ConfigDefaults {
    model_map: Record<string, string>;
    personas: string[];
}

interface ValidationState {
    status: 'valid' | 'invalid' | 'loading' | null;
    message?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ConfigPage() {
    const { settings, setSettings } = useCouncilStore();
    const [defaults, setDefaults] = useState<ConfigDefaults | null>(null);

    // Draft State
    const [draftApiKey, setDraftApiKey] = useState('');
    const [draftModelMap, setDraftModelMap] = useState<Record<string, string>>({});

    // Validation State
    const [apiKeyStatus, setApiKeyStatus] = useState<ValidationState>({ status: null });
    const [modelStatuses, setModelStatuses] = useState<Record<string, ValidationState>>({});
    const [loadingDefaults, setLoadingDefaults] = useState(true);

    // Initialize
    useEffect(() => {
        setDraftApiKey(settings.apiKey || '');
        if (settings.modelOverrides) {
            setDraftModelMap(settings.modelOverrides);
        }

        fetch(`${API_BASE}/api/config-defaults`)
            .then(res => res.json())
            .then((data: ConfigDefaults) => {
                setDefaults(data);
                setLoadingDefaults(false);
            })
            .catch(err => {
                console.error("Failed to load config defaults", err);
                setLoadingDefaults(false);
            });
    }, []);

    // Handlers
    const handleApiKeyChange = (val: string) => {
        setDraftApiKey(val);
        setApiKeyStatus({ status: null }); // Reset status on change
    };

    const handleModelChange = (agent: string, val: string) => {
        setDraftModelMap(prev => ({ ...prev, [agent]: val }));
        setModelStatuses(prev => ({ ...prev, [agent]: { status: null } }));
    };

    // --- Validation Logic ---
    const verifyApiKey = async () => {
        if (!draftApiKey) {
            setApiKeyStatus({ status: 'valid', message: 'Using Default Server Key' });
            return;
        }

        setApiKeyStatus({ status: 'loading' });
        try {
            const res = await fetch(`${API_BASE}/api/check-credentials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: draftApiKey })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || `Error ${res.status}`);
            }

            setApiKeyStatus({ status: 'valid', message: 'Credentials Verified' });
        } catch (e: any) {
            setApiKeyStatus({ status: 'invalid', message: e.message });
        }
    };

    const verifyModels = async () => {
        // Only verify modified (dirty) fields present in draftModelMap
        // Logic: Iterate over draftModelMap keys.
        // If value is empty -> It's a reset to default -> Skip validation -> Set status valid
        // If value is not empty -> Verify

        const agentsToCheck = Object.keys(draftModelMap);

        // Set loading for all targets
        const newStatuses = { ...modelStatuses };
        agentsToCheck.forEach(agent => {
            if (draftModelMap[agent]) {
                newStatuses[agent] = { status: 'loading' };
            } else {
                newStatuses[agent] = { status: null }; // Reset empty ones
            }
        });
        setModelStatuses(newStatuses);

        // Parallel requests
        await Promise.all(agentsToCheck.map(async (agent) => {
            const modelId = draftModelMap[agent];
            if (!modelId) return; // Skip empty

            try {
                const res = await fetch(`${API_BASE}/api/check-model`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model_id: modelId,
                        api_key: draftApiKey || undefined // Use current draft key for context
                    })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || `Error ${res.status}`);
                }

                setModelStatuses(prev => ({
                    ...prev,
                    [agent]: { status: 'valid', message: 'Verified' }
                }));
            } catch (e: any) {
                setModelStatuses(prev => ({
                    ...prev,
                    [agent]: { status: 'invalid', message: e.message }
                }));
            }
        }));
    };

    // Save Guardrail
    const hasErrors = apiKeyStatus.status === 'invalid' || Object.values(modelStatuses).some(s => s.status === 'invalid');
    const isLoading = apiKeyStatus.status === 'loading' || Object.values(modelStatuses).some(s => s.status === 'loading');

    // Strict Save Guardrail
    // User Requirement: "save configuration button should not work until all the configurations are either checked or are default"
    // Meaning: For every entry in draftModelMap:
    // - If it has a value (non-empty), its status MUST be 'valid'.
    // - If it is empty, it's fine (default).
    // - Also, API Key must check out if provided.

    const areModelsVerified = Object.keys(draftModelMap).every(key => {
        const val = draftModelMap[key];
        if (!val || val.trim() === '') return true; // Empty is fine (default)
        return modelStatuses[key]?.status === 'valid';
    });

    const isApiKeyVerified = !draftApiKey || apiKeyStatus.status === 'valid'; // Empty key uses server default, or explicit valid

    const canSave = areModelsVerified && isApiKeyVerified;

    const handleSave = () => {
        if (!canSave) {
            alert("Please verify all changes before saving.\n\nEvery model and API key must be validated against the server to ensure system integrity.");
            return;
        }

        // Filter out empty overrides to clean up store
        const cleanedOverrides: Record<string, string> = {};
        Object.entries(draftModelMap).forEach(([k, v]) => {
            if (v && v.trim() !== "") cleanedOverrides[k] = v;
        });

        setSettings({
            apiKey: draftApiKey,
            modelOverrides: cleanedOverrides
        });

        // Optional: Show a toast or feedback
        alert("Configuration Saved Successfully!");
    };

    if (loadingDefaults) {
        return <div className="flex h-screen items-center justify-center text-cyan-500 animate-pulse">Initializing Configuration Matrix...</div>;
    }

    return (
        <div className="p-8 pb-32">
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Header */}
                <header className="flex items-center gap-4 mb-8 border-b border-[var(--border-base)] pb-6">
                    <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                        <Cpu className="w-8 h-8 text-cyan-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight uppercase">System Configuration</h1>
                        <p className="text-[var(--text-muted)] mt-1">Override default protocols and security keys.</p>
                    </div>
                </header>

                {/* API Key Section */}
                <section className="bg-[var(--bg-panel)] rounded-xl border border-[var(--border-base)] p-6 shadow-sm">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="p-2 bg-indigo-500/10 rounded-md text-indigo-500">
                            <Key className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-semibold mb-2">OpenRouter API Access</h2>
                            <p className="text-sm text-[var(--text-muted)] mb-4">
                                Your custom API key is stored locally. Leaving this empty uses the server default.
                            </p>
                            <div className="flex gap-4 items-start">
                                <div className="flex-1 relative">
                                    <input
                                        type="password"
                                        value={draftApiKey}
                                        onChange={(e) => handleApiKeyChange(e.target.value)}
                                        placeholder="sk-or-v1-..."
                                        className={`
                                            w-full bg-[var(--bg-panel-secondary)] border rounded-lg px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 transition-all
                                            ${apiKeyStatus.status === 'invalid' ? 'border-red-500 focus:ring-red-500/50' :
                                                apiKeyStatus.status === 'valid' ? 'border-emerald-500 focus:ring-emerald-500/50' :
                                                    'border-[var(--border-base)] focus:ring-indigo-500/50'}
                                        `}
                                    />
                                    <div className="absolute right-3 top-3">
                                        {apiKeyStatus.status === 'loading' && <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />}
                                        {apiKeyStatus.status === 'valid' && <Check className="w-5 h-5 text-emerald-500" />}
                                        {apiKeyStatus.status === 'invalid' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                                    </div>
                                    {apiKeyStatus.message && (
                                        <p className={`text-xs mt-2 ${apiKeyStatus.status === 'invalid' ? 'text-red-500' : 'text-emerald-500'}`}>
                                            {apiKeyStatus.message}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={verifyApiKey}
                                    disabled={apiKeyStatus.status === 'loading'}
                                    className="px-4 py-3 bg-[var(--bg-panel-secondary)] border border-[var(--border-base)] hover:bg-[var(--bg-app)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                    Verify Key
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Model Configuration */}
                <section className="bg-[var(--bg-panel)] rounded-xl border border-[var(--border-base)] p-6 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="flex gap-4">
                            <div className="p-2 bg-emerald-500/10 rounded-md text-emerald-500">
                                <RefreshCcw className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold mb-2">Agent Model Alignment</h2>
                                <p className="text-sm text-[var(--text-muted)]">
                                    Assign specific models to council members.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={verifyModels}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                            Verify Changes
                        </button>
                    </div>


                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 relative z-10">
                        {defaults && defaults.personas.map(agent => (
                            <ModelInput
                                key={agent}
                                label={agent}
                                value={draftModelMap[agent] || ''}
                                defaultValue={defaults.model_map[`generator_${defaults.personas.indexOf(agent) + 1}`] || defaults.model_map['generator_1']}
                                status={modelStatuses[agent]}
                                onChange={(val) => handleModelChange(agent, val)}
                            />
                        ))}

                        <ModelInput
                            label="Critic"
                            value={draftModelMap['critic'] || ''}
                            defaultValue={defaults?.model_map['critic'] || ''}
                            status={modelStatuses['critic']}
                            onChange={(val) => handleModelChange('critic', val)}
                        />
                        <ModelInput
                            label="Architect"
                            value={draftModelMap['architect'] || ''}
                            defaultValue={defaults?.model_map['architect'] || ''}
                            status={modelStatuses['architect']}
                            onChange={(val) => handleModelChange('architect', val)}
                        />
                        <ModelInput
                            label="Finalizer"
                            value={draftModelMap['finalizer'] || ''}
                            defaultValue={defaults?.model_map['finalizer'] || ''}
                            status={modelStatuses['finalizer']}
                            onChange={(val) => handleModelChange('finalizer', val)}
                        />
                    </div>
                </section>

                {/* API Warning Note */}
                <div className="flex items-start gap-3 p-6 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500">
                    <AlertTriangle className="w-8 h-8 flex-shrink-0" />
                    <p className="text-lg font-medium leading-relaxed">
                        Note: All verification checks perform real-time API calls to OpenRouter to ensure connectivity and model availability.
                    </p>
                </div>

                {/* Global Save Action */}
                <div className="fixed bottom-0 left-[72px] md:left-[288px] right-0 bg-[var(--bg-panel)] border-t border-[var(--border-base)] p-4 flex justify-end items-center gap-4 z-50">
                    <div className="text-xs text-[var(--text-muted)]">
                        {isLoading ? "Validating configuration..." : hasErrors ? "Please resolve errors before saving." : "Ready to apply changes."}
                    </div>
                    <button
                        onClick={handleSave}
                        className={`
                            flex items-center gap-2 px-8 py-3 rounded-lg font-bold uppercase tracking-wider transition-all
                            ${canSave
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 hover:scale-105 cursor-pointer'
                                : 'bg-[var(--bg-panel-secondary)] text-[var(--text-muted)] opacity-50 cursor-pointer'}
                        `}
                    >
                        <Save className="w-4 h-4" />
                        Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
}

// Sub-component for inputs
function ModelInput({ label, value, defaultValue, onChange, status }: {
    label: string,
    value: string,
    defaultValue: string,
    onChange: (val: string) => void,
    status?: ValidationState
}) {
    // Determine visual state
    const isInvalid = status?.status === 'invalid';
    const isValid = status?.status === 'valid';
    const isLoading = status?.status === 'loading';

    return (
        <div className="bg-[var(--bg-panel-secondary)] p-4 rounded-lg border border-[var(--border-base)] transition-colors hover:border-cyan-500/30 group">
            <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-bold text-[var(--text-main)] group-hover:text-cyan-500 transition-colors">{label}</label>
            </div>
            <div className="relative">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={defaultValue}
                    className={`
                        w-full bg-[var(--bg-panel)] border rounded px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 transition-all
                        ${isInvalid ? 'border-red-500 ring-red-500/20' :
                            isValid ? 'border-emerald-500 ring-emerald-500/20' :
                                'border-[var(--border-base)] focus:border-cyan-500 focus:ring-cyan-500/50'}
                    `}
                />
                <div className="absolute right-2 top-2">
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />}
                    {isValid && <Check className="w-4 h-4 text-emerald-500" />}
                    {isInvalid && <AlertTriangle className="w-4 h-4 text-red-500" />}
                </div>
            </div>
            {status?.message && (
                <p className={`text-[10px] mt-1.5 font-medium ${isInvalid ? 'text-red-500' : 'text-emerald-500'}`}>
                    {status.message}
                </p>
            )}
        </div>
    );
}
