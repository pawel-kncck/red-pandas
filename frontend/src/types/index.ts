export interface Session {
  id: string;
  filename: string;
  created_at: string;
  row_count: number;
  column_count: number;
  columns?: string[];
  dtypes?: Record<string, string>;
  data_sample?: any[];
  conversation_history?: ConversationEntry[];
}

export interface ConversationEntry {
  id: string;
  question: string;
  code: string;
  result: any;
  interpretation: string;
  error?: string;
  timestamp: string;
}

export interface AnalysisResponse {
  question: string;
  generated_code: string;
  raw_result: any;
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