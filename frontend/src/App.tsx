import { useState, useEffect, useRef } from 'react';
import { Send, Upload, FileSpreadsheet, Code2, Eye, EyeOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import { sessionsApi } from '@/api/sessions';
import type { Session, AnalysisResponse } from '@/types';

function App() {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<AnalysisResponse[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedCode, setExpandedCode] = useState<Set<number>>(new Set());
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [conversations]);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const response = await sessionsApi.createSession(file);
      const session = await sessionsApi.getSession(response.session_id);
      setCurrentSession(session);
      setConversations([]);
      toast.success('Data uploaded successfully');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to upload file';
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFileUpload(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    disabled: isUploading,
    noClick: true,
  });

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
        error: error?.response?.data?.detail || 'Failed to analyze data',
        execution_time: 0,
        conversation_id: '',
      };
      setConversations([...conversations, errorResponse]);
      toast.error('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isAnalyzing) {
      handleQuery(query.trim());
      setQuery('');
    }
  };

  const toggleCode = (index: number) => {
    const newExpanded = new Set(expandedCode);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCode(newExpanded);
  };

  const clearSession = () => {
    setCurrentSession(null);
    setConversations([]);
    setExpandedCode(new Set());
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 max-w-4xl mx-auto flex flex-col p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Red Pandas</h1>
          <p className="text-sm text-muted-foreground">LLM-powered data analytics</p>
        </div>

        {/* Main Chat Area */}
        <Card className="flex-1 flex flex-col bg-card border-border">
          {!currentSession ? (
            // Initial Upload View
            <div 
              {...getRootProps()}
              className={`flex-1 flex items-center justify-center p-8 ${
                isDragActive ? 'bg-accent/10' : ''
              }`}
            >
              <input {...getInputProps()} />
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <div className="text-center space-y-4 max-w-md">
                <FileSpreadsheet className="h-16 w-16 mx-auto text-muted-foreground" />
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-foreground">
                    {isDragActive ? 'Drop your CSV file here' : 'Upload CSV to start'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop your CSV file here or click the button below
                  </p>
                </div>
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  size="lg"
                  className="font-medium"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent mr-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Select CSV File
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Session Info Bar */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/50">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{currentSession.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {currentSession.row_count} rows × {currentSession.column_count} columns
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    id="reupload"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('reupload')?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSession}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Chat Messages */}
              <ScrollArea className="flex-1 px-6 py-4" ref={scrollAreaRef}>
                {conversations.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        Ready to analyze your data
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Ask any question about {currentSession.filename}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {conversations.map((conv, index) => (
                      <div key={index} className="space-y-3">
                        {/* User Question */}
                        <div className="flex justify-end">
                          <div className="max-w-[80%] bg-primary text-primary-foreground rounded-lg px-4 py-2">
                            <p className="text-sm">{conv.question}</p>
                          </div>
                        </div>

                        {/* Assistant Response */}
                        <div className="flex justify-start">
                          <div className="max-w-[80%] space-y-2">
                            {conv.error ? (
                              <Card className="bg-destructive/10 border-destructive/20 px-4 py-2">
                                <p className="text-sm text-destructive">{conv.error}</p>
                              </Card>
                            ) : (
                              <>
                                <Card className="bg-secondary border-border px-4 py-3">
                                  <p className="text-sm text-foreground whitespace-pre-wrap">
                                    {conv.interpretation}
                                  </p>
                                </Card>

                                {/* Code Toggle */}
                                {conv.generated_code && (
                                  <div className="space-y-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleCode(index)}
                                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                      {expandedCode.has(index) ? (
                                        <>
                                          <EyeOff className="h-3 w-3 mr-1" />
                                          Hide code
                                        </>
                                      ) : (
                                        <>
                                          <Eye className="h-3 w-3 mr-1" />
                                          Show code
                                        </>
                                      )}
                                    </Button>

                                    {expandedCode.has(index) && (
                                      <Card className="bg-black border-border">
                                        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                                          <Code2 className="h-3 w-3 text-muted-foreground" />
                                          <span className="text-xs text-muted-foreground font-mono">Python</span>
                                        </div>
                                        <pre className="px-4 py-3 text-xs font-mono text-foreground overflow-x-auto">
                                          <code>{conv.generated_code}</code>
                                        </pre>
                                      </Card>
                                    )}
                                  </div>
                                )}

                                {/* Result if available */}
                                {conv.raw_result !== null && conv.raw_result !== undefined && (
                                  <Card className="bg-secondary/50 border-border px-4 py-3">
                                    <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
                                      {typeof conv.raw_result === 'string' 
                                        ? conv.raw_result 
                                        : JSON.stringify(conv.raw_result, null, 2)}
                                    </pre>
                                  </Card>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Loading indicator */}
                    {isAnalyzing && (
                      <div className="flex justify-start">
                        <Card className="bg-secondary border-border px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-primary border-t-transparent" />
                            <p className="text-sm text-muted-foreground">Analyzing...</p>
                          </div>
                        </Card>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* Input Area */}
              <div className="border-t border-border p-4">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask a question about your data..."
                    className="flex-1 min-h-[56px] max-h-[120px] resize-none bg-secondary border-border text-foreground placeholder:text-muted-foreground font-sans"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    disabled={isAnalyzing}
                  />
                  <Button
                    type="submit"
                    disabled={!query.trim() || isAnalyzing}
                    size="icon"
                    className="h-[56px] w-[56px]"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </Card>
      </div>
      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}

export default App;