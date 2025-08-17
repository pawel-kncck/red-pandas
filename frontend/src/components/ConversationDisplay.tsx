import React from 'react';
import { User, Bot, Code, AlertCircle } from 'lucide-react';

interface ConversationItem {
  question: string;
  interpretation: string;
  generated_code: string;
  raw_result?: unknown;
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
  const formatResult = (result: unknown): string => {
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