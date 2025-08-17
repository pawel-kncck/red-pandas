export interface Session {
  id: string;
  filename: string;
  created_at: string;
  row_count: number;
  column_count: number;
  columns?: string[];
  dtypes?: Record<string, string>;
  data_sample?: unknown[];
  conversation_history?: ConversationEntry[];
  conversations?: AnalysisResponse[];
}

export interface ConversationEntry {
  id: string;
  question: string;
  code: string;
  result: unknown;
  interpretation: string;
  error?: string;
  timestamp: string;
}

export interface AnalysisResponse {
  question: string;
  generated_code: string;
  raw_result: unknown;
  interpretation: string;
  error?: string;
  execution_time: number;
  conversation_id: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: string;
  openai: string;
  timestamp: string;
}

export interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
}