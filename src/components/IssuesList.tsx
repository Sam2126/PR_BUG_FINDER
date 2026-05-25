import React, { useState, useMemo } from 'react';
import {
  AlertTriangle, Shield, Bug, Zap, Code2, Lightbulb,
  ChevronDown, ChevronRight, FileCode2, ExternalLink,
  Filter, CheckCircle2, Copy, Check
} from 'lucide-react';
import type { ReviewIssue, Severity, IssueCategory } from '../types';

interface IssuesListProps {
  issues: ReviewIssue[];
  onIssueClick: (issue: ReviewIssue) => void;
  selectedIssueId: string | null;
}

const SEVERITY_CONFIG: Record<Severity, { icon: React.ReactNode; label: string; className: string }> = {
  critical: { icon: <AlertTriangle size={14} />, label: 'Critical', className: 'badge--critical' },
  warning: { icon: <Shield size={14} />, label: 'Warning', className: 'badge--warning' },
  info: { icon: <Zap size={14} />, label: 'Info', className: 'badge--info' },
  suggestion: { icon: <Lightbulb size={14} />, label: 'Suggestion', className: 'badge--suggestion' },
};

const CATEGORY_CONFIG: Record<IssueCategory, { icon: React.ReactNode; label: string }> = {
  'bug': { icon: <Bug size={14} />, label: 'Bug' },
  'security': { icon: <Shield size={14} />, label: 'Security' },
  'performance': { icon: <Zap size={14} />, label: 'Performance' },
  'code-smell': { icon: <Code2 size={14} />, label: 'Code Smell' },
  'best-practice': { icon: <Lightbulb size={14} />, label: 'Best Practice' },
};

type FilterType = 'all' | Severity | IssueCategory;

export const IssuesList: React.FC<IssuesListProps> = ({ issues, onIssueClick, selectedIssueId }) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredIssues = useMemo(() => {
    if (activeFilter === 'all') return issues;
    return issues.filter(
      issue => issue.severity === activeFilter || issue.category === activeFilter
    );
  }, [issues, activeFilter]);

  const toggleExpand = (id: string) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const severityFilters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: issues.length },
    { key: 'critical', label: 'Critical', count: issues.filter(i => i.severity === 'critical').length },
    { key: 'warning', label: 'Warning', count: issues.filter(i => i.severity === 'warning').length },
    { key: 'info', label: 'Info', count: issues.filter(i => i.severity === 'info').length },
    { key: 'suggestion', label: 'Suggest', count: issues.filter(i => i.severity === 'suggestion').length },
  ];

  const categoryFilters: { key: FilterType; label: string; count: number }[] = [
    { key: 'security', label: 'Security', count: issues.filter(i => i.category === 'security').length },
    { key: 'bug', label: 'Bugs', count: issues.filter(i => i.category === 'bug').length },
    { key: 'performance', label: 'Perf', count: issues.filter(i => i.category === 'performance').length },
    { key: 'code-smell', label: 'Smells', count: issues.filter(i => i.category === 'code-smell').length },
  ];

  return (
    <div className="issues-panel">
      <div className="issues__header">
        <h3 className="issues__title">
          <Filter size={18} />
          Issues
          <span className="badge badge--info">{filteredIssues.length}</span>
        </h3>
      </div>

      <div className="issues__filters">
        <div className="issues__filter-row">
          {severityFilters.map(f => (
            <button
              key={f.key}
              className={`issues__filter-btn ${activeFilter === f.key ? 'issues__filter-btn--active' : ''} ${f.key !== 'all' ? `issues__filter-btn--${f.key}` : ''}`}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
              {f.count > 0 && <span className="issues__filter-count">{f.count}</span>}
            </button>
          ))}
        </div>
        <div className="issues__filter-row">
          {categoryFilters.filter(f => f.count > 0).map(f => (
            <button
              key={f.key}
              className={`issues__filter-btn issues__filter-btn--category ${activeFilter === f.key ? 'issues__filter-btn--active' : ''}`}
              onClick={() => setActiveFilter(activeFilter === f.key ? 'all' : f.key)}
            >
              {CATEGORY_CONFIG[f.key as IssueCategory]?.icon}
              {f.label}
              <span className="issues__filter-count">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="issues__list">
        {filteredIssues.map((issue, index) => {
          const isExpanded = expandedIssues.has(issue.id);
          const severityInfo = SEVERITY_CONFIG[issue.severity];
          const categoryInfo = CATEGORY_CONFIG[issue.category];

          return (
            <div
              key={issue.id}
              className={`issue-card glass-card issue-card--${issue.severity} ${isExpanded ? 'issue-card--expanded' : ''} ${selectedIssueId === issue.id ? 'issue-card--selected' : ''}`}
              style={{ animationDelay: `${index * 0.03}s` }}
            >
              <div
                className="issue-card__header"
                onClick={() => { toggleExpand(issue.id); onIssueClick(issue); }}
              >
                <div className="issue-card__severity">
                  <span className={`badge ${severityInfo.className}`}>
                    {severityInfo.icon}
                    {severityInfo.label}
                  </span>
                  <span className="badge badge--category">
                    {categoryInfo.icon}
                    {categoryInfo.label}
                  </span>
                </div>
                <h4 className="issue-card__title">{issue.title}</h4>
                <div className="issue-card__meta">
                  <span className="issue-card__location" onClick={(e) => { e.stopPropagation(); onIssueClick(issue); }}>
                    <FileCode2 size={12} />
                    {issue.file}:{issue.line}
                  </span>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              </div>

              {isExpanded && (
                <div className="issue-card__body animate-in">
                  <p className="issue-card__description">{issue.description}</p>

                  {issue.codeSnippet && (
                    <div className="issue-card__code-section">
                      <div className="issue-card__code-header">
                        <span className="text-red">✗ Current Code</span>
                        <button className="btn-icon-sm" onClick={() => copyCode(issue.codeSnippet!, issue.id + '-bad')}>
                          {copiedId === issue.id + '-bad' ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                      <pre className="issue-card__code issue-card__code--bad">
                        <code>{issue.codeSnippet}</code>
                      </pre>
                    </div>
                  )}

                  {issue.fixedCode && (
                    <div className="issue-card__code-section">
                      <div className="issue-card__code-header">
                        <span className="text-green">✓ Suggested Fix</span>
                        <button className="btn-icon-sm" onClick={() => copyCode(issue.fixedCode!, issue.id + '-fix')}>
                          {copiedId === issue.id + '-fix' ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                      <pre className="issue-card__code issue-card__code--good">
                        <code>{issue.fixedCode}</code>
                      </pre>
                    </div>
                  )}

                  <div className="issue-card__suggestion">
                    <Lightbulb size={14} className="text-cyan" />
                    <span>{issue.suggestion}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IssuesList;
