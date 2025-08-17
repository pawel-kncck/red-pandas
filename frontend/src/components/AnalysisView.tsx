import { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Trash2, 
  Code2, 
  MessageSquare,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Session, AnalysisResponse } from '@/types';

interface AnalysisViewProps {
  session: Session;
  conversations: AnalysisResponse[];
  isAnalyzing: boolean;
  onQuery: (question: string) => void;
  onDeleteSession: () => void;
}

export function AnalysisView({
  session,
  conversations,
  isAnalyzing,
  onQuery,
  onDeleteSession,
}: AnalysisViewProps) {
  const [query, setQuery] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when new conversation is added
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [conversations]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isAnalyzing) {
      onQuery(query.trim());
      setQuery('');
    }
  };

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCards(newExpanded);
  };

  const formatCode = (code: string) => {
    return code.split('\n').map((line, i) => (
      <div key={i} className="table-row">
        <span className="table-cell pr-4 text-muted-foreground select-none text-xs">
          {i + 1}
        </span>
        <span className="table-cell">
          <code>{line || '\u00A0'}</code>
        </span>
      </div>
    ));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {session.filename}
            </h2>
            <p className="text-sm text-muted-foreground">
              {session.row_count} rows × {session.column_count} columns
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteSession}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1 px-6 py-4" ref={scrollAreaRef}>
        {conversations.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-3">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Ready to analyze your data
                </p>
                <p className="text-sm text-muted-foreground">
                  Ask any question about your {session.filename} file
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {conversations.map((conv, index) => (
              <Card key={index} className="p-4 space-y-3">
                {/* Question */}
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {conv.question}
                    </p>
                  </div>
                </div>

                {/* Response */}
                {conv.error ? (
                  <div className="flex items-start gap-3 pl-7">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-destructive flex-shrink-0" />
                    <p className="text-sm text-destructive">{conv.error}</p>
                  </div>
                ) : (
                  <div className="pl-7 space-y-3">
                    {/* Interpretation */}
                    <div className="text-sm text-foreground whitespace-pre-wrap">
                      {conv.interpretation}
                    </div>

                    {/* Code and Result Tabs */}
                    {conv.generated_code && (
                      <Tabs defaultValue="result" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="result">Result</TabsTrigger>
                          <TabsTrigger value="code">Code</TabsTrigger>
                        </TabsList>
                        <TabsContent value="result" className="mt-3">
                          {conv.raw_result !== null && conv.raw_result !== undefined && (
                            <Card className="p-3 bg-secondary">
                              <pre className="text-xs text-foreground overflow-x-auto">
                                {typeof conv.raw_result === 'string' 
                                  ? conv.raw_result 
                                  : JSON.stringify(conv.raw_result, null, 2)}
                              </pre>
                            </Card>
                          )}
                        </TabsContent>
                        <TabsContent value="code" className="mt-3">
                          <Card className="p-3 bg-secondary">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Code2 className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  Generated Python Code
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => toggleExpanded(index)}
                              >
                                {expandedCards.has(index) ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                            <div className={`overflow-x-auto ${
                              expandedCards.has(index) ? '' : 'max-h-32 overflow-y-hidden'
                            }`}>
                              <div className="table text-xs font-mono">
                                {formatCode(conv.generated_code)}
                              </div>
                            </div>
                          </Card>
                        </TabsContent>
                      </Tabs>
                    )}

                    {/* Execution Time */}
                    {conv.execution_time > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{conv.execution_time.toFixed(2)}s</span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}

            {/* Loading indicator */}
            {isAnalyzing && (
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                  <p className="text-sm text-muted-foreground">Analyzing...</p>
                </div>
              </Card>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Query Input */}
      <div className="border-t border-border p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about your data..."
            className="flex-1 min-h-[60px] max-h-[120px] resize-none"
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
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}