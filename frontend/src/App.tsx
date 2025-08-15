import { useState, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { QueryInput } from './components/QueryInput';
import { ConversationDisplay } from './components/ConversationDisplay';
import { SessionInfo } from './components/SessionInfo';
import { sessionsApi } from './api/sessions';
import type { Session, AnalysisResponse } from './types';
import { Activity, ChevronLeft, Trash2 } from 'lucide-react';

function App() {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<AnalysisResponse[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'degraded' | 'unhealthy'>('healthy');

  // Check API health on mount
  useEffect(() => {
    checkHealth();
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

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError('');
    
    try {
      const response = await sessionsApi.createSession(file);
      
      // Fetch full session details
      const session = await sessionsApi.getSession(response.session_id);
      setCurrentSession(session);
      setConversations([]);
    } catch (error: any) {
      setUploadError(
        error.response?.data?.detail || 'Failed to upload file. Please try again.'
      );
      console.error('Upload error:', error);
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
    } catch (error: any) {
      const errorResponse: AnalysisResponse = {
        question,
        generated_code: '',
        raw_result: null,
        interpretation: '',
        error: error.response?.data?.detail || 'Failed to analyze data. Please try again.',
        execution_time: 0,
        conversation_id: '',
      };
      setConversations([...conversations, errorResponse]);
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNewSession = () => {
    setCurrentSession(null);
    setConversations([]);
    setUploadError('');
  };

  const handleDeleteSession = async () => {
    if (!currentSession) return;
    
    if (window.confirm('Are you sure you want to delete this session?')) {
      try {
        await sessionsApi.deleteSession(currentSession.id);
        handleNewSession();
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Activity className="w-8 h-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Red Pandas</h1>
              <span className="text-sm text-gray-500">LLM-powered Data Analytics</span>
            </div>
            
            {/* Health Status Indicator */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                healthStatus === 'healthy' ? 'bg-green-500' : 
                healthStatus === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-600">
                {healthStatus === 'healthy' ? 'Connected' : 
                 healthStatus === 'degraded' ? 'Degraded' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!currentSession ? (
          // Upload View
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Upload your data to get started
              </h2>
              <p className="text-gray-600">
                Upload a CSV file and ask questions in natural language
              </p>
            </div>
            
            <FileUpload
              onFileSelect={handleFileUpload}
              isUploading={isUploading}
              error={uploadError}
            />
            
            {/* Example Queries */}
            <div className="mt-12 p-6 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3">Example queries:</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• What are the top 5 products by revenue?</li>
                <li>• Show me the trend over the last 6 months</li>
                <li>• Which category has the highest growth rate?</li>
                <li>• Summarize the key insights from this data</li>
                <li>• What's the correlation between price and sales volume?</li>
              </ul>
            </div>
          </div>
        ) : (
          // Analysis View
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Sidebar - Session Info */}
            <div className="lg:col-span-1">
              <div className="sticky top-4 space-y-4">
                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={handleNewSession}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    New Session
                  </button>
                  <button
                    onClick={handleDeleteSession}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete session"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Session Info */}
                <SessionInfo
                  filename={currentSession.filename}
                  rowCount={currentSession.row_count}
                  columnCount={currentSession.column_count}
                  columns={currentSession.columns || []}
                  createdAt={currentSession.created_at}
                />
              </div>
            </div>
            
            {/* Right Content - Conversation */}
            <div className="lg:col-span-2 space-y-6">
              {/* Query Input */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <QueryInput
                  onSubmit={handleQuery}
                  isLoading={isAnalyzing}
                  placeholder="Ask a question about your data..."
                />
              </div>
              
              {/* Conversation History */}
              {conversations.length > 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <ConversationDisplay
                    conversations={conversations}
                    isLoading={isAnalyzing}
                  />
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                  <Activity className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Ready to analyze your data
                  </h3>
                  <p className="text-gray-600">
                    Ask any question about your {currentSession.filename} file
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;