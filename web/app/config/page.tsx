'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Cpu, Key, Loader2, RefreshCcw, Save, Shield } from 'lucide-react';

import { getApiUrl } from '@/lib/api';
import { canSaveSettings, cleanModelOverrides } from '@/store/configState';
import { useCouncilStore } from '@/store/councilStore';
import type { ValidationState } from '@/store/types';

interface ConfigDefaults {
  model_map: Record<string, string>;
  personas: string[];
  mock_mode: boolean;
  trace_logs_enabled: boolean;
}

type FeedbackTone = 'success' | 'warning' | 'info';

export default function ConfigPage() {
  const { settings, setSettings } = useCouncilStore();
  const [defaults, setDefaults] = useState<ConfigDefaults | null>(null);
  const [draftApiKey, setDraftApiKey] = useState('');
  const [draftModelMap, setDraftModelMap] = useState<Record<string, string>>({});
  const [apiKeyStatus, setApiKeyStatus] = useState<ValidationState>({ status: null });
  const [modelStatuses, setModelStatuses] = useState<Record<string, ValidationState>>({});
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null);

  useEffect(() => {
    setDraftApiKey(settings.apiKey || '');
    setDraftModelMap(settings.modelOverrides || {});
  }, [settings.apiKey, settings.modelOverrides]);

  useEffect(() => {
    fetch(getApiUrl('/api/config-defaults'))
      .then((response) => response.json())
      .then((data: ConfigDefaults) => {
        setDefaults(data);
        setLoadingDefaults(false);
      })
      .catch(() => {
        setFeedback({
          tone: 'warning',
          message:
            'Failed to load server defaults. Local settings are still editable, but verification may fail until the backend is reachable.',
        });
        setLoadingDefaults(false);
      });
  }, []);

  const handleApiKeyChange = (value: string) => {
    setDraftApiKey(value);
    setApiKeyStatus({ status: null });
    setFeedback(null);
  };

  const handleModelChange = (agent: string, value: string) => {
    setDraftModelMap((current) => ({ ...current, [agent]: value }));
    setModelStatuses((current) => ({ ...current, [agent]: { status: null } }));
    setFeedback(null);
  };

  const verifyApiKey = async () => {
    if (!draftApiKey) {
      setApiKeyStatus({ status: 'valid', message: 'Using default server key.' });
      setFeedback({
        tone: 'info',
        message:
          'No custom API key provided. The app will use the server-side key if one is configured.',
      });
      return;
    }

    setApiKeyStatus({ status: 'loading' });
    try {
      const response = await fetch(getApiUrl('/api/check-credentials'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: draftApiKey }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `Error ${response.status}`);
      }

      setApiKeyStatus({ status: 'valid', message: 'Credentials verified.' });
      setFeedback({
        tone: 'success',
        message:
          'The custom API key is valid and can be used for runtime overrides and model verification.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to verify the API key.';
      setApiKeyStatus({ status: 'invalid', message });
      setFeedback({ tone: 'warning', message });
    }
  };

  const verifyModels = async () => {
    const agentsToCheck = Object.keys(draftModelMap);
    const nextStatuses = { ...modelStatuses };

    agentsToCheck.forEach((agent) => {
      if (draftModelMap[agent]) {
        nextStatuses[agent] = { status: 'loading' };
      } else {
        nextStatuses[agent] = { status: null };
      }
    });

    setModelStatuses(nextStatuses);
    setFeedback(null);

    const results = await Promise.all(
      agentsToCheck.map(async (agent) => {
        const modelId = draftModelMap[agent];
        if (!modelId) {
          return { agent, status: { status: null } as ValidationState };
        }

        try {
          const response = await fetch(getApiUrl('/api/check-model'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model_id: modelId,
              api_key: draftApiKey || undefined,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Error ${response.status}`);
          }

          return {
            agent,
            status: { status: 'valid', message: 'Verified.' } as ValidationState,
          };
        } catch (error: unknown) {
          return {
            agent,
            status: {
              status: 'invalid',
              message: error instanceof Error ? error.message : 'Unable to verify model.',
            } as ValidationState,
          };
        }
      }),
    );

    const mergedStatuses = results.reduce<Record<string, ValidationState>>((accumulator, result) => {
      accumulator[result.agent] = result.status;
      return accumulator;
    }, { ...nextStatuses });

    setModelStatuses(mergedStatuses);

    const failedChecks = Object.values(mergedStatuses).some((status) => status.status === 'invalid');
    setFeedback({
      tone: failedChecks ? 'warning' : 'success',
      message: failedChecks
        ? 'One or more model checks failed. Review the inline messages before saving.'
        : 'Model verification finished. Verified overrides are ready to save.',
    });
  };

  const hasErrors =
    apiKeyStatus.status === 'invalid' ||
    Object.values(modelStatuses).some((status) => status.status === 'invalid');
  const isLoading =
    apiKeyStatus.status === 'loading' ||
    Object.values(modelStatuses).some((status) => status.status === 'loading');
  const canSave = canSaveSettings(draftApiKey, apiKeyStatus, draftModelMap, modelStatuses);

  const handleSave = () => {
    if (!canSave) {
      setFeedback({
        tone: 'warning',
        message:
          'Verify every custom model override and custom API key before saving. Empty fields are treated as defaults and do not need verification.',
      });
      return;
    }

    setSettings({
      apiKey: draftApiKey,
      modelOverrides: cleanModelOverrides(draftModelMap),
    });

    setFeedback({
      tone: 'success',
      message:
        'Configuration saved locally. Custom API keys live in browser storage, so this setup is best for local or single-user deployments.',
    });
  };

  if (loadingDefaults) {
    return (
      <div className="flex h-screen items-center justify-center text-cyan-500 animate-pulse">
        Initializing configuration matrix...
      </div>
    );
  }

  return (
    <div className="p-8 pb-32">
      <div className="mx-auto max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="mb-8 flex items-center gap-4 border-b border-[var(--border-base)] pb-6">
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
            <Cpu className="h-8 w-8 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight">System Configuration</h1>
            <p className="mt-1 text-[var(--text-muted)]">
              Override default protocols, model routing, and runtime credentials.
            </p>
          </div>
        </header>

        {feedback && (
          <div
            className={`rounded-2xl border px-5 py-4 text-sm ${
              feedback.tone === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                : feedback.tone === 'warning'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                  : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <section className="rounded-xl border border-[var(--border-base)] bg-[var(--bg-panel)] p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-4">
            <div className="rounded-md bg-indigo-500/10 p-2 text-indigo-500">
              <Key className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="mb-2 text-xl font-semibold">OpenRouter API Access</h2>
              <p className="mb-4 text-sm text-[var(--text-muted)]">
                Your custom API key is stored locally in this browser. Leaving it empty uses the server default.
              </p>
              <div className="flex items-start gap-4">
                <div className="relative flex-1">
                  <input
                    type="password"
                    value={draftApiKey}
                    onChange={(event) => handleApiKeyChange(event.target.value)}
                    placeholder="sk-or-v1-..."
                    className={`w-full rounded-lg border bg-[var(--bg-panel-secondary)] px-4 py-3 font-mono text-sm transition-all focus:outline-none focus:ring-2 ${
                      apiKeyStatus.status === 'invalid'
                        ? 'border-red-500 focus:ring-red-500/50'
                        : apiKeyStatus.status === 'valid'
                          ? 'border-emerald-500 focus:ring-emerald-500/50'
                          : 'border-[var(--border-base)] focus:ring-indigo-500/50'
                    }`}
                  />
                  <div className="absolute right-3 top-3">
                    {apiKeyStatus.status === 'loading' && (
                      <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
                    )}
                    {apiKeyStatus.status === 'valid' && (
                      <Check className="h-5 w-5 text-emerald-500" />
                    )}
                    {apiKeyStatus.status === 'invalid' && (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  {apiKeyStatus.message && (
                    <p
                      className={`mt-2 text-xs ${
                        apiKeyStatus.status === 'invalid' ? 'text-red-500' : 'text-emerald-500'
                      }`}
                    >
                      {apiKeyStatus.message}
                    </p>
                  )}
                </div>
                <button
                  onClick={verifyApiKey}
                  disabled={apiKeyStatus.status === 'loading'}
                  className="whitespace-nowrap rounded-lg border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--bg-app)] disabled:opacity-50"
                >
                  Verify Key
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-xl border border-[var(--border-base)] bg-[var(--bg-panel)] p-6 shadow-sm">
          <div className="relative z-10 mb-6 flex items-start justify-between">
            <div className="flex gap-4">
              <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-500">
                <RefreshCcw className="h-5 w-5" />
              </div>
              <div>
                <h2 className="mb-2 text-xl font-semibold">Agent Model Alignment</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Assign specific models to council members and synthesis phases.
                </p>
              </div>
            </div>
            <button
              onClick={verifyModels}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              Verify Changes
            </button>
          </div>

          <div className="relative z-10 grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {defaults?.personas.map((agent, index) => (
              <ModelInput
                key={agent}
                label={agent}
                value={draftModelMap[agent] || ''}
                defaultValue={
                  defaults.model_map[`generator_${index + 1}`] || defaults.model_map.generator_1 || ''
                }
                status={modelStatuses[agent]}
                onChange={(value) => handleModelChange(agent, value)}
              />
            ))}

            <ModelInput
              label="Critic"
              value={draftModelMap.critic || ''}
              defaultValue={defaults?.model_map.critic || ''}
              status={modelStatuses.critic}
              onChange={(value) => handleModelChange('critic', value)}
            />
            <ModelInput
              label="Architect"
              value={draftModelMap.architect || ''}
              defaultValue={defaults?.model_map.architect || ''}
              status={modelStatuses.architect}
              onChange={(value) => handleModelChange('architect', value)}
            />
            <ModelInput
              label="Finalizer"
              value={draftModelMap.finalizer || ''}
              defaultValue={defaults?.model_map.finalizer || ''}
              status={modelStatuses.finalizer}
              onChange={(value) => handleModelChange('finalizer', value)}
            />
          </div>
        </section>

        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-amber-500">
          <AlertTriangle className="h-8 w-8 flex-shrink-0" />
          <div className="space-y-2">
            <p className="text-lg font-medium leading-relaxed">
              Verification makes live API calls to OpenRouter. Custom API keys are saved in browser storage and are best suited for local or single-user deployments.
            </p>
            <p className="text-sm opacity-80">
              Server defaults: mock mode is <strong>{defaults?.mock_mode ? 'enabled' : 'disabled'}</strong>; trace logging is <strong>{defaults?.trace_logs_enabled ? 'enabled' : 'disabled'}</strong>.
            </p>
          </div>
        </div>

        <div className="fixed bottom-0 right-0 left-[72px] z-50 flex items-center justify-end gap-4 border-t border-[var(--border-base)] bg-[var(--bg-panel)] p-4 md:left-[320px]">
          <div className="text-xs text-[var(--text-muted)]">
            {isLoading
              ? 'Validating configuration...'
              : hasErrors
                ? 'Please resolve errors before saving.'
                : 'Ready to apply changes.'}
          </div>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 rounded-lg px-8 py-3 font-bold uppercase tracking-wider transition-all ${
              canSave
                ? 'cursor-pointer bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:scale-105 hover:bg-indigo-500'
                : 'cursor-pointer bg-[var(--bg-panel-secondary)] text-[var(--text-muted)] opacity-50'
            }`}
          >
            <Save className="h-4 w-4" />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

function ModelInput({
  label,
  value,
  defaultValue,
  onChange,
  status,
}: {
  label: string;
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  status?: ValidationState;
}) {
  const isInvalid = status?.status === 'invalid';
  const isValid = status?.status === 'valid';
  const isLoading = status?.status === 'loading';

  return (
    <div className="group rounded-lg border border-[var(--border-base)] bg-[var(--bg-panel-secondary)] p-4 transition-colors hover:border-cyan-500/30">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-bold text-[var(--text-main)] transition-colors group-hover:text-cyan-500">
          {label}
        </label>
      </div>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={defaultValue}
          className={`w-full rounded border bg-[var(--bg-panel)] px-3 py-2 text-xs font-mono transition-all focus:outline-none focus:ring-1 ${
            isInvalid
              ? 'border-red-500 ring-red-500/20'
              : isValid
                ? 'border-emerald-500 ring-emerald-500/20'
                : 'border-[var(--border-base)] focus:border-cyan-500 focus:ring-cyan-500/50'
          }`}
        />
        <div className="absolute right-2 top-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />}
          {isValid && <Check className="h-4 w-4 text-emerald-500" />}
          {isInvalid && <AlertTriangle className="h-4 w-4 text-red-500" />}
        </div>
      </div>
      {status?.message && (
        <p className={`mt-1.5 text-[10px] font-medium ${isInvalid ? 'text-red-500' : 'text-emerald-500'}`}>
          {status.message}
        </p>
      )}
    </div>
  );
}
