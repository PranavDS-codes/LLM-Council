import type { ValidationState } from './types';

export function areModelsVerified(
  draftModelMap: Record<string, string>,
  modelStatuses: Record<string, ValidationState>,
): boolean {
  return Object.keys(draftModelMap).every((key) => {
    const value = draftModelMap[key];
    if (!value || value.trim() === '') {
      return true;
    }
    return modelStatuses[key]?.status === 'valid';
  });
}

export function isApiKeyVerified(draftApiKey: string, apiKeyStatus: ValidationState): boolean {
  return !draftApiKey || apiKeyStatus.status === 'valid';
}

export function canSaveSettings(
  draftApiKey: string,
  apiKeyStatus: ValidationState,
  draftModelMap: Record<string, string>,
  modelStatuses: Record<string, ValidationState>,
): boolean {
  return areModelsVerified(draftModelMap, modelStatuses) && isApiKeyVerified(draftApiKey, apiKeyStatus);
}

export function cleanModelOverrides(draftModelMap: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(draftModelMap).filter(([, value]) => Boolean(value && value.trim())),
  );
}

