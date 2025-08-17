import { useCallback } from 'react';
import { Upload, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface DataUploadViewProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
}

export function DataUploadView({ onFileSelect, isUploading }: DataUploadViewProps) {
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

  const exampleQueries = [
    'What are the top 5 products by revenue?',
    'Show me the trend over the last 6 months',
    'Which category has the highest growth rate?',
    'Summarize the key insights from this data',
    'What\'s the correlation between price and sales volume?',
  ];

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Upload your data to get started
          </h1>
          <p className="text-muted-foreground">
            Upload a CSV file and ask questions in natural language
          </p>
        </div>

        <Card
          {...getRootProps()}
          className={`
            border-2 border-dashed p-12 text-center cursor-pointer
            transition-all duration-200
            ${isDragActive ? 'border-primary bg-accent' : 'border-border hover:border-primary/50'}
            ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center space-y-4">
            {isUploading ? (
              <>
                <div className="animate-pulse">
                  <Upload className="h-12 w-12 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {isDragActive ? 'Drop the file here' : 'Drop your CSV file here'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    or click to browse
                  </p>
                </div>
                <Button variant="outline" size="sm" className="mt-2">
                  <Upload className="h-4 w-4 mr-2" />
                  Select File
                </Button>
              </>
            )}
          </div>
        </Card>

        <Card className="p-6 bg-card">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Example queries you can ask:
              </h3>
              <ul className="space-y-2">
                {exampleQueries.map((query, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {query}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}