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