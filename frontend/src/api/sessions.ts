import { apiClient, uploadClient } from './client';
import type { Session, AnalysisResponse, HealthStatus } from '../types';

export const sessionsApi = {
  // Check API health
  checkHealth: async (): Promise<HealthStatus> => {
    const response = await apiClient.get('/api/health');
    return response.data;
  },

  // Create new session with CSV upload
  createSession: async (file: File): Promise<{
    session_id: string;
    message: string;
    data_info: Record<string, unknown>;
  }> => {
    console.log('Creating session with file:', file.name, file.size, file.type);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await uploadClient.post('/api/session/create', formData);
      console.log('Upload response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  },

  // Get session details
  getSession: async (sessionId: string): Promise<Session> => {
    const response = await apiClient.get(`/api/session/${sessionId}`);
    return response.data;
  },

  // List all sessions
  listSessions: async (): Promise<{ sessions: Session[]; total: number }> => {
    const response = await apiClient.get('/api/sessions');
    return response.data;
  },

  // Get all sessions (simplified)
  getSessions: async (): Promise<Session[]> => {
    const response = await apiClient.get('/api/sessions');
    return response.data.sessions || [];
  },

  // Analyze data with query
  analyzeData: async (sessionId: string, question: string): Promise<AnalysisResponse> => {
    const response = await apiClient.post(`/api/session/${sessionId}/analyze`, {
      question,
    });
    return response.data;
  },

  // Delete session
  deleteSession: async (sessionId: string): Promise<void> => {
    await apiClient.delete(`/api/session/${sessionId}`);
  },
};