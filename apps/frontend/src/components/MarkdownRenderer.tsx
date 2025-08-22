import React from 'react';
import { Remark } from 'react-remark';
import { ErrorBoundary } from 'react-error-boundary';

interface MarkdownRendererProps {
  content: string;
}

const FallbackComponent = ({ content }: { content: string }) => {
  return <span className="text-gray-700">{content}</span>;
};

const MarkdownContent = React.memo(({ content }: MarkdownRendererProps) => {
  return (
    <div className="markdown">
      <Remark>{content}</Remark>
    </div>
  );
});

MarkdownContent.displayName = 'MarkdownContent';

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <ErrorBoundary FallbackComponent={() => <FallbackComponent content={content} />}>
      <MarkdownContent content={content} />
    </ErrorBoundary>
  );
}; 