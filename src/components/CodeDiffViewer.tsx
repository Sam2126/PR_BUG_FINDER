import React, { useState, useRef, useEffect } from 'react';
import {
  FileCode2, AlertTriangle, Shield, Bug, Zap,
  Lightbulb, ChevronDown, ChevronRight, Plus, Minus,
  MessageSquare
} from 'lucide-react';
import type { FileAnalysis, ReviewIssue, Severity } from '../types';

interface CodeDiffViewerProps {
  files: FileAnalysis[];
  selectedFile: string | null;
  onFileSelect: (filename: string) => void;
  highlightedIssue: ReviewIssue | null;
}

interface DiffLine {
  type: 'added' | 'removed' | 'context' | 'header';
  content: string;
  oldLineNum: number | null;
  newLineNum: number | null;
}

function parsePatch(patch: string): DiffLine[] {
  if (!patch) return [];
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLine = parseInt(match[1]) - 1;
        newLine = parseInt(match[2]) - 1;
      }
      lines.push({ type: 'header', content: line, oldLineNum: null, newLineNum: null });
    } else if (line.startsWith('+')) {
      newLine++;
      lines.push({ type: 'added', content: line.substring(1), oldLineNum: null, newLineNum: newLine });
    } else if (line.startsWith('-')) {
      oldLine++;
      lines.push({ type: 'removed', content: line.substring(1), oldLineNum: oldLine, newLineNum: null });
    } else {
      oldLine++;
      newLine++;
      lines.push({ type: 'context', content: line.replace(/^ /, ''), oldLineNum: oldLine, newLineNum: newLine });
    }
  }

  return lines;
}

const SEVERITY_ICON: Record<Severity, React.ReactNode> = {
  critical: <AlertTriangle size={14} />,
  warning: <Shield size={14} />,
  info: <Zap size={14} />,
  suggestion: <Lightbulb size={14} />,
};

export const CodeDiffViewer: React.FC<CodeDiffViewerProps> = ({
  files,
  selectedFile,
  onFileSelect,
  highlightedIssue,
}) => {
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const lineRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const codeRef = useRef<HTMLDivElement>(null);

  const currentFile = files.find(f => f.filename === selectedFile) || files[0];
  const diffLines = currentFile ? parsePatch(currentFile.patch) : [];
  const fileIssues = currentFile?.issues || [];

  // Scroll to highlighted issue
  useEffect(() => {
    if (highlightedIssue && currentFile) {
      if (highlightedIssue.file !== currentFile.filename) {
        onFileSelect(highlightedIssue.file);
      }
      setTimeout(() => {
        const key = `line-${highlightedIssue.line}`;
        const el = lineRefs.current.get(key);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [highlightedIssue, currentFile]);

  const getIssuesForLine = (lineNum: number | null): ReviewIssue[] => {
    if (!lineNum) return [];
    return fileIssues.filter(i => i.line === lineNum);
  };

  const toggleComment = (id: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="diff-viewer animate-in">
      {/* File Tabs */}
      <div className="diff-viewer__tabs">
        {files.map(file => {
          const issueCount = file.issues.length;
          const hasCritical = file.issues.some(i => i.severity === 'critical');
          return (
            <button
              key={file.filename}
              className={`diff-viewer__tab ${file.filename === (currentFile?.filename) ? 'diff-viewer__tab--active' : ''} ${hasCritical ? 'diff-viewer__tab--critical' : ''}`}
              onClick={() => onFileSelect(file.filename)}
            >
              <FileCode2 size={14} />
              <span className="diff-viewer__tab-name">
                {file.filename.split('/').pop()}
              </span>
              {issueCount > 0 && (
                <span className={`diff-viewer__tab-badge ${hasCritical ? 'diff-viewer__tab-badge--critical' : ''}`}>
                  {issueCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* File Header */}
      {currentFile && (
        <div className="diff-viewer__header">
          <div className="diff-viewer__filename">
            <FileCode2 size={16} className="text-cyan" />
            <span>{currentFile.filename}</span>
          </div>
          <div className="diff-viewer__file-stats">
            <span className="diff-viewer__stat diff-viewer__stat--add">
              <Plus size={12} /> {currentFile.additions}
            </span>
            <span className="diff-viewer__stat diff-viewer__stat--del">
              <Minus size={12} /> {currentFile.deletions}
            </span>
            <span className="diff-viewer__stat">
              {currentFile.language}
            </span>
          </div>
        </div>
      )}

      {/* Diff Content */}
      <div className="diff-viewer__content" ref={codeRef}>
        {diffLines.map((line, index) => {
          const lineNum = line.newLineNum || line.oldLineNum;
          const lineIssues = getIssuesForLine(line.newLineNum);
          const isHighlighted = highlightedIssue && lineNum === highlightedIssue.line && currentFile?.filename === highlightedIssue.file;

          return (
            <React.Fragment key={index}>
              <div
                ref={el => {
                  if (el && lineNum) lineRefs.current.set(`line-${lineNum}`, el);
                }}
                className={`diff-line diff-line--${line.type} ${lineIssues.length > 0 ? `diff-line--flagged diff-line--flagged-${lineIssues[0].severity}` : ''} ${isHighlighted ? 'diff-line--highlighted' : ''}`}
              >
                <span className="diff-line__number diff-line__number--old">
                  {line.type === 'header' ? '' : line.oldLineNum || ''}
                </span>
                <span className="diff-line__number diff-line__number--new">
                  {line.type === 'header' ? '' : line.newLineNum || ''}
                </span>
                <span className="diff-line__marker">
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : line.type === 'header' ? '' : ' '}
                </span>
                <span className="diff-line__content">
                  {line.type === 'header' ? <em className="diff-line__header-text">{line.content}</em> : line.content}
                </span>
                {lineIssues.length > 0 && (
                  <button
                    className={`diff-line__issue-btn diff-line__issue-btn--${lineIssues[0].severity}`}
                    onClick={() => toggleComment(lineIssues[0].id)}
                    title={lineIssues[0].title}
                  >
                    <MessageSquare size={12} />
                    {lineIssues.length}
                  </button>
                )}
              </div>

              {/* Inline AI Comments */}
              {lineIssues.map(issue => (
                (expandedComments.has(issue.id) || isHighlighted) && (
                  <div key={issue.id} className={`diff-comment diff-comment--${issue.severity} animate-in`}>
                    <div className="diff-comment__header">
                      <span className={`badge badge--${issue.severity}`}>
                        {SEVERITY_ICON[issue.severity]}
                        {issue.severity}
                      </span>
                      <span className="diff-comment__category">
                        {issue.category}
                      </span>
                    </div>
                    <h4 className="diff-comment__title">{issue.title}</h4>
                    <p className="diff-comment__desc">{issue.description}</p>
                    {issue.fixedCode && (
                      <div className="diff-comment__fix">
                        <span className="diff-comment__fix-label">💡 Suggested fix:</span>
                        <pre className="diff-comment__fix-code"><code>{issue.fixedCode}</code></pre>
                      </div>
                    )}
                  </div>
                )
              ))}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default CodeDiffViewer;
