import { useState, useEffect } from 'react';
import {
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { DataUploadView } from '@/components/DataUploadView';
import { AnalysisView } from '@/components/AnalysisView';
import { sessionsApi } from '@/api/sessions';
import type { Session, AnalysisResponse, ApiError } from '@/types';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

function App() {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<AnalysisResponse[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'degraded' | 'unhealthy'>('healthy');

  // Check API health on mount
  useEffect(() => {
    checkHealth();
    loadSessions();
  }, []);

  const checkHealth = async () => {
    try {
      const health = await sessionsApi.checkHealth();
      setHealthStatus(health.status);
    } catch (error) {
      setHealthStatus('unhealthy');
      console.error('Health check failed:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const sessionsData = await sessionsApi.getSessions();
      setSessions(sessionsData);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const handleFileUpload = async (file: File) => {
    console.log('Starting file upload:', file.name, file.size, file.type);
    setIsUploading(true);
    
    try {
      const response = await sessionsApi.createSession(file);
      console.log('Session created:', response);
      
      const session = await sessionsApi.getSession(response.session_id);
      console.log('Session loaded:', session);
      
      setCurrentSession(session);
      setConversations([]);
      await loadSessions();
      toast.success('Data uploaded successfully');
    } catch (error: any) {
      console.error('Full error object:', error);
      const errorMessage = error?.response?.data?.detail || 
                          error?.message || 
                          'Failed to upload file';
      toast.error(errorMessage);
      console.error('Upload error:', errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuery = async (question: string) => {
    if (!currentSession) return;
    
    setIsAnalyzing(true);
    
    try {
      const response = await sessionsApi.analyzeData(currentSession.id, question);
      setConversations([...conversations, response]);
    } catch (error) {
      const errorResponse: AnalysisResponse = {
        question,
        generated_code: '',
        raw_result: null,
        interpretation: '',
        error: (error as ApiError).response?.data?.detail || 'Failed to analyze data',
        execution_time: 0,
        conversation_id: '',
      };
      setConversations([...conversations, errorResponse]);
      toast.error('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNewSession = () => {
    setCurrentSession(null);
    setConversations([]);
  };

  const handleDeleteSession = async () => {
    if (!currentSession) return;
    
    try {
      await sessionsApi.deleteSession(currentSession.id);
      await loadSessions();
      handleNewSession();
      toast.success('Session deleted');
    } catch (error) {
      toast.error('Failed to delete session');
      console.error('Delete error:', error);
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    try {
      const session = await sessionsApi.getSession(sessionId);
      setCurrentSession(session);
      // Map conversation_history to conversations format if needed
      const conversations = session.conversation_history?.map((entry: any) => ({
        question: entry.question,
        generated_code: entry.code || '',
        raw_result: entry.result,
        interpretation: entry.interpretation || '',
        error: entry.error,
        execution_time: 0,
        conversation_id: entry.id || '',
      })) || [];
      setConversations(conversations);
    } catch (error) {
      toast.error('Failed to load session');
      console.error('Load session error:', error);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background">
        <AppSidebar
          sessions={sessions}
          currentSession={currentSession}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          healthStatus={healthStatus}
        />
        
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-border px-4 py-3 flex items-center">
            <SidebarTrigger className="-ml-1" />
            <div className="ml-4 flex-1">
              <h1 className="text-sm font-medium text-muted-foreground">
                Red Pandas
              </h1>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto">
            {!currentSession ? (
              <DataUploadView
                onFileSelect={handleFileUpload}
                isUploading={isUploading}
              />
            ) : (
              <AnalysisView
                session={currentSession}
                conversations={conversations}
                isAnalyzing={isAnalyzing}
                onQuery={handleQuery}
                onDeleteSession={handleDeleteSession}
              />
            )}
          </div>
        </main>
      </div>
      <Toaster position="bottom-right" theme="dark" />
    </SidebarProvider>
  );
}

export default App;