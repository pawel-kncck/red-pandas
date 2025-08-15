# Red Pandas Frontend Implementation Plan

## Project Status Summary

### ✅ Completed Components (Backend)
- **FastAPI Backend**: Fully implemented with all endpoints
- **MongoDB Integration**: Database connection and operations working
- **OpenAI Integration**: Code generation and interpretation functional
- **Security Layer**: AST validation and sandboxed execution implemented
- **API Endpoints**: All 5 endpoints operational
  - `/api/health` - Health check
  - `/api/session/create` - Upload CSV and create session
  - `/api/session/{session_id}/analyze` - Analyze data
  - `/api/session/{session_id}` - Get session details
  - `/api/sessions` - List all sessions

### ⏳ Pending Components (Frontend)
- Complete React frontend application
- All UI components and interactions
- API client integration

## Frontend Implementation Guide

### Prerequisites
- Node.js 18+ and npm installed
- Backend server running at `http://localhost:8000`
- MongoDB running (local or Atlas)
- `.env` file configured in backend directory

---

## Phase 1: Frontend Setup (30 minutes)

### Step 1.1: Initialize React Project
```bash
# From project root
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

### Step 1.2: Install Dependencies
```bash
npm install axios react-dropzone lucide-react
npm install -D tailwindcss postcss autoprefixer @types/react @types/react-dom
npx tailwindcss init -p
```

### Step 1.3: Configure Tailwind CSS
**File**: `frontend/tailwind.config.js`
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**File**: `frontend/src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 1.4: Environment Configuration
**File**: `frontend/.env`
```
VITE_API_URL=http://localhost:8000
```

---

## Phase 2: API Client Setup (20 minutes)

### Step 2.1: Create API Client
**File**: `frontend/src/api/client.ts`

```typescript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add multipart/form-data header for file uploads
export const uploadClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});
```

### Step 2.2: Define TypeScript Types
**File**: `frontend/src/types/index.ts`

```typescript
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
```

### Step 2.3: Create API Service Functions
**File**: `frontend/src/api/sessions.ts`

```typescript
import { apiClient, uploadClient } from './client';
import { Session, AnalysisResponse, HealthStatus } from '../types';

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
    data_info: any;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await uploadClient.post('/api/session/create', formData);
    return response.data;
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
```

---

## Phase 3: Core Components (1 hour)

### Step 3.1: File Upload Component
**File**: `frontend/src/components/FileUpload.tsx`

```typescript
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  error?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  isUploading,
  error,
}) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          <p className="text-lg">Drop the CSV file here...</p>
        ) : (
          <>
            <p className="text-lg mb-2">Drag & drop a CSV file here</p>
            <p className="text-sm text-gray-500">or click to select file</p>
            <p className="text-xs text-gray-400 mt-2">Max file size: 100MB</p>
          </>
        )}
      </div>
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}
    </div>
  );
};
```

### Step 3.2: Query Input Component
**File**: `frontend/src/components/QueryInput.tsx`

```typescript
import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface QueryInputProps {
  onSubmit: (question: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export const QueryInput: React.FC<QueryInputProps> = ({
  onSubmit,
  isLoading,
  placeholder = "Ask a question about your data...",
}) => {
  const [question, setQuestion] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() && !isLoading) {
      onSubmit(question.trim());
      setQuestion('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!question.trim() || isLoading}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:text-blue-600 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </form>
  );
};
```

### Step 3.3: Conversation Display Component
**File**: `frontend/src/components/ConversationDisplay.tsx`

```typescript
import React from 'react';
import { User, Bot, Code, AlertCircle } from 'lucide-react';

interface ConversationItem {
  question: string;
  interpretation: string;
  generated_code: string;
  raw_result?: any;
  error?: string;
  execution_time?: number;
}

interface ConversationDisplayProps {
  conversations: ConversationItem[];
  isLoading?: boolean;
}

export const ConversationDisplay: React.FC<ConversationDisplayProps> = ({
  conversations,
  isLoading,
}) => {
  const formatResult = (result: any): string => {
    if (result === null || result === undefined) return 'No result';
    if (typeof result === 'object') {
      return JSON.stringify(result, null, 2);
    }
    return String(result);
  };

  return (
    <div className="space-y-6">
      {conversations.map((item, index) => (
        <div key={index} className="space-y-4">
          {/* User Question */}
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">You</p>
              <p className="mt-1 text-gray-700">{item.question}</p>
            </div>
          </div>

          {/* AI Response */}
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Assistant</p>
                {item.error ? (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center">
                      <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                      <span className="text-red-700">{item.error}</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-gray-700 whitespace-pre-wrap">{item.interpretation}</p>
                )}
              </div>

              {/* Generated Code */}
              {item.generated_code && (
                <details className="group">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 flex items-center">
                    <Code className="w-4 h-4 mr-1" />
                    View generated code
                    {item.execution_time && (
                      <span className="ml-2 text-xs">
                        (executed in {item.execution_time.toFixed(2)}s)
                      </span>
                    )}
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-100 rounded-md overflow-x-auto text-xs">
                    <code>{item.generated_code}</code>
                  </pre>
                </details>
              )}

              {/* Raw Result */}
              {item.raw_result !== undefined && item.raw_result !== null && (
                <details className="group">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    View raw data
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-100 rounded-md overflow-x-auto text-xs">
                    <code>{formatResult(item.raw_result)}</code>
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Assistant</p>
            <div className="mt-2 flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

### Step 3.4: Session Info Component
**File**: `frontend/src/components/SessionInfo.tsx`

```typescript
import React from 'react';
import { FileText, Database, Hash, Calendar } from 'lucide-react';

interface SessionInfoProps {
  filename: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  createdAt: string;
}

export const SessionInfo: React.FC<SessionInfoProps> = ({
  filename,
  rowCount,
  columnCount,
  columns,
  createdAt,
}) => {
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <h3 className="font-semibold text-gray-900">Data Summary</h3>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="text-gray-600">File:</span>
          <span className="font-medium">{filename}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-gray-600">Uploaded:</span>
          <span className="font-medium">
            {new Date(createdAt).toLocaleString()}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-gray-500" />
          <span className="text-gray-600">Rows:</span>
          <span className="font-medium">{rowCount.toLocaleString()}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Hash className="w-4 h-4 text-gray-500" />
          <span className="text-gray-600">Columns:</span>
          <span className="font-medium">{columnCount}</span>
        </div>
      </div>
      
      <details className="group">
        <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
          View columns ({columns.length})
        </summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {columns.map((col, idx) => (
            <span
              key={idx}
              className="px-2 py-1 text-xs bg-white border border-gray-200 rounded"
            >
              {col}
            </span>
          ))}
        </div>
      </details>
    </div>
  );
};
```

---

## Phase 4: Main App Component (45 minutes)

### Step 4.1: Main App Implementation
**File**: `frontend/src/App.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { QueryInput } from './components/QueryInput';
import { ConversationDisplay } from './components/ConversationDisplay';
import { SessionInfo } from './components/SessionInfo';
import { sessionsApi } from './api/sessions';
import { Session, AnalysisResponse } from './types';
import { Activity, ChevronLeft, Trash2, AlertCircle } from 'lucide-react';

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
```

### Step 4.2: Update Main Entry
**File**: `frontend/src/main.tsx`

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

## Phase 5: Testing Instructions (15 minutes)

### Step 5.1: Backend Setup
```bash
# Terminal 1: Start MongoDB (if using Docker)
docker run -d -p 27017:27017 --name red-pandas-mongo mongo

# Terminal 2: Start backend server
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env file with your OpenAI API key
echo "OPENAI_API_KEY=your_key_here" > .env
echo "MONGODB_URL=mongodb://localhost:27017/" >> .env
echo "DATABASE_NAME=red_pandas_db" >> .env

# Run backend
uvicorn main:app --reload
```

### Step 5.2: Frontend Setup
```bash
# Terminal 3: Start frontend
cd frontend
npm install
npm run dev
```

### Step 5.3: Test the Application
1. Open browser to `http://localhost:5173`
2. Check health indicator shows "Connected"
3. Upload a sample CSV file
4. Verify file info displays correctly
5. Ask a test question: "How many rows are in the data?"
6. Verify response and code generation
7. Ask follow-up questions to test conversation context
8. Test error handling with invalid query
9. Create new session and test switching
10. Test session deletion

---

## Testing Checklist

### ✅ Basic Functionality
- [ ] Frontend loads without errors
- [ ] Health check shows correct status
- [ ] File upload accepts CSV files
- [ ] File upload rejects non-CSV files
- [ ] File upload shows progress
- [ ] Session info displays correctly
- [ ] Questions can be submitted
- [ ] Responses are displayed
- [ ] Code can be viewed
- [ ] Raw results can be viewed

### ✅ Error Handling
- [ ] Upload errors are displayed
- [ ] Analysis errors are displayed
- [ ] Network errors are handled
- [ ] Invalid queries show error messages

### ✅ User Experience
- [ ] Loading states work correctly
- [ ] UI is responsive on mobile
- [ ] Conversation history scrolls properly
- [ ] Code blocks have syntax highlighting
- [ ] Session can be deleted
- [ ] New session can be created

---

## Common Issues & Solutions

### Issue 1: CORS Errors
**Solution**: Ensure backend CORS middleware includes frontend URL:
```python
allow_origins=["http://localhost:5173"]
```

### Issue 2: MongoDB Connection Failed
**Solution**: 
- Check MongoDB is running: `docker ps`
- Verify connection string in `.env`
- Try `mongodb://127.0.0.1:27017/` instead of localhost

### Issue 3: OpenAI API Errors
**Solution**:
- Verify API key in backend `.env`
- Check API key has sufficient credits
- Ensure API key has proper permissions

### Issue 4: File Upload Fails
**Solution**:
- Check file size (< 100MB)
- Ensure CSV is properly formatted
- Check backend logs for specific error

### Issue 5: TypeScript Errors
**Solution**:
```bash
npm install --save-dev @types/react @types/react-dom
```

---

## Next Steps After MVP

Once the basic frontend is working:

1. **Enhance UI/UX**:
   - Add data preview table
   - Implement syntax highlighting for code
   - Add copy-to-clipboard for code/results
   - Implement dark mode

2. **Add Features**:
   - Session history sidebar
   - Export results to CSV/JSON
   - Save favorite queries
   - Keyboard shortcuts

3. **Improve Performance**:
   - Implement virtualization for large results
   - Add request caching
   - Optimize bundle size

4. **Add Visualizations**:
   - Integrate chart library (Chart.js/Recharts)
   - Auto-detect chart-worthy results
   - Interactive data exploration

---

## Estimated Timeline

- **Phase 1**: Frontend Setup - 30 minutes
- **Phase 2**: API Client - 20 minutes  
- **Phase 3**: Components - 1 hour
- **Phase 4**: Main App - 45 minutes
- **Phase 5**: Testing - 15 minutes

**Total Time**: ~3 hours for complete frontend implementation

---

## Success Criteria

The MVP is complete when:
- ✅ Users can upload CSV files
- ✅ Upload errors are handled gracefully
- ✅ Users can ask questions about data
- ✅ System generates and displays code
- ✅ Results are interpreted and displayed
- ✅ Conversation history is maintained
- ✅ Users can start new sessions
- ✅ Application works on localhost
- ✅ All API endpoints are integrated
- ✅ Basic error handling is in place

---

## Developer Notes

1. **Keep It Simple**: This is an MVP - focus on core functionality
2. **Test Incrementally**: Test each component as you build
3. **Use TypeScript**: Helps catch errors early
4. **Follow React Best Practices**: Use hooks, functional components
5. **Handle Loading States**: Users should always know what's happening
6. **Error Messages**: Make them user-friendly and actionable

This plan provides everything needed to build a functional frontend that integrates with the existing backend. The implementation is straightforward and can be completed in approximately 3 hours by following the steps sequentially.