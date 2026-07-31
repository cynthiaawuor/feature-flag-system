export interface EnvironmentConfig {
  enabled: boolean;
  targetedUserIds: string[];
  rolloutPercentage: number | null;
  updatedBy: string;
  updatedAt: string;
}

export interface Flag {
  id: string;
  key: string;
  description: string;
  createdBy: string;
  createdAt: string;
  environments: Record<string, EnvironmentConfig>;
}

export interface HistoryEntry {
  id: string;
  flagId: string;
  environment: string | null;
  actor: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}
