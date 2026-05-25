import React, { useEffect, useState } from 'react';
import {
  FileCode2, CheckCircle2, Loader2, AlertCircle,
  Clock, Shield, Bug
} from 'lucide-react';
import type { FileAnalysis } from '../types';

interface AnalysisProgressProps {
  files: FileAnalysis[];
  currentFileIndex: number;
  totalIssues: number;
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({
  files,
  currentFileIndex,
  totalIssues,
}) => {
  const completedFiles = files.filter(f => f.status === 'complete').length;
  const progress = files.length > 0 ? (completedFiles / files.length) * 100 : 0;
  const isComplete = completedFiles === files.length && files.length > 0;

  const [displayedIssues, setDisplayedIssues] = useState(0);
  
  useEffect(() => {
    if (displayedIssues < totalIssues) {
      const timer = setTimeout(() => setDisplayedIssues(prev => prev + 1), 80);
      return () => clearTimeout(timer);
    }
  }, [displayedIssues, totalIssues]);

  return (
    <div className="analysis-container animate-in">
      <div className="analysis__header">
        <div className="analysis__icon-ring">
          {isComplete ? (
            <CheckCircle2 size={40} className="text-green" />
          ) : (
            <Loader2 size={40} className="text-cyan analysis__spinner" />
          )}
        </div>
        <h2 className="analysis__title">
          {isComplete ? 'Analysis Complete' : 'Analyzing Pull Request...'}
        </h2>
        <p className="analysis__subtitle">
          {isComplete
            ? `Found ${totalIssues} issues across ${files.length} files`
            : `Reviewing file ${Math.min(currentFileIndex + 1, files.length)} of ${files.length}`
          }
        </p>
      </div>

      <div className="analysis__progress-bar-container">
        <div className="analysis__progress-bar">
          <div
            className="analysis__progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="analysis__progress-text">{Math.round(progress)}%</span>
      </div>

      <div className="analysis__stats-row">
        <div className="analysis__stat-mini glass-card">
          <FileCode2 size={18} className="text-cyan" />
          <div>
            <div className="analysis__stat-value">{completedFiles}/{files.length}</div>
            <div className="analysis__stat-label">Files Reviewed</div>
          </div>
        </div>
        <div className="analysis__stat-mini glass-card">
          <Bug size={18} className="text-red" />
          <div>
            <div className="analysis__stat-value">{displayedIssues}</div>
            <div className="analysis__stat-label">Issues Found</div>
          </div>
        </div>
        <div className="analysis__stat-mini glass-card">
          <Shield size={18} className="text-violet" />
          <div>
            <div className="analysis__stat-value">
              {files.filter(f => f.status === 'analyzing').length > 0 ? 'Active' : isComplete ? 'Done' : 'Waiting'}
            </div>
            <div className="analysis__stat-label">AI Agent</div>
          </div>
        </div>
      </div>

      <div className="analysis__file-list glass-card">
        {files.map((file, index) => (
          <div
            key={file.filename}
            className={`analysis__file analysis__file--${file.status}`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="analysis__file-icon">
              {file.status === 'complete' && <CheckCircle2 size={16} className="text-green" />}
              {file.status === 'analyzing' && <Loader2 size={16} className="text-cyan analysis__spinner" />}
              {file.status === 'pending' && <Clock size={16} className="text-muted" />}
              {file.status === 'error' && <AlertCircle size={16} className="text-red" />}
            </div>
            <span className="analysis__file-name">{file.filename}</span>
            <span className="analysis__file-lang">{file.language}</span>
            {file.status === 'complete' && file.issues.length > 0 && (
              <span className="analysis__file-issues">
                {file.issues.length} issue{file.issues.length !== 1 ? 's' : ''}
              </span>
            )}
            {file.status === 'complete' && file.issues.length === 0 && (
              <span className="analysis__file-clean">Clean ✓</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnalysisProgress;
