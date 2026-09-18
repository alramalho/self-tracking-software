export interface ApiKeySummary {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreatedApiKey extends ApiKeySummary {
  key: string;
}

export interface IntegrationsSettingsProps {
  onOpenAppleHealth: () => void;
  onOpenGarmin: () => void;
  onOpenApiKeys: () => void;
}
