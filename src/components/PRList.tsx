import React from 'react';
import {
  Shield, GitPullRequest,
  GitBranch, FileCode2, Plus, Minus
} from 'lucide-react';
import type { PullRequest } from '../types';

interface PRListProps {
  pullRequests: PullRequest[];
  onSelect: (pr: PullRequest) => void;
  selectedPR: PullRequest | null;
}

export const PRList: React.FC<PRListProps> = ({ pullRequests, onSelect, selectedPR }) => {
  return (
    <div className="pr-section animate-in">
      <div className="section-header">
        <GitPullRequest size={22} className="text-violet" />
        <h2>Open Pull Requests</h2>
        <span className="badge badge--info">{pullRequests.length} open</span>
      </div>
      {pullRequests.length === 0 && (
        <div className="pr-empty animate-in">
          <div className="pr-empty__icon">
            <GitPullRequest size={48} />
          </div>
          <h3 className="pr-empty__title">No open pull requests</h3>
          <p className="pr-empty__text">
            This repository has no open pull requests to review. Create a PR on GitHub or try the interactive demo to see CodeLens AI in action.
          </p>
        </div>
      )}
      {pullRequests.length > 0 && (
        <div className="pr-grid">
          {pullRequests.map((pr, index) => (
            <div
              key={pr.number}
              className={`pr-card glass-card ${selectedPR?.number === pr.number ? 'pr-card--selected' : ''}`}
              onClick={() => onSelect(pr)}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="pr-card__header">
                <img
                  src={pr.authorAvatar}
                  alt={pr.author}
                  className="pr-card__avatar"
                />
                <div className="pr-card__title-group">
                  <h3 className="pr-card__title">
                    {pr.title}
                    <span className="pr-card__number">#{pr.number}</span>
                  </h3>
                  <span className="pr-card__author">
                    by <strong>{pr.author}</strong> · {getTimeAgo(pr.createdAt)}
                  </span>
                </div>
              </div>

              <p className="pr-card__description">{pr.description}</p>

              <div className="pr-card__meta">
                <div className="pr-card__stat">
                  <FileCode2 size={14} />
                  <span>{pr.changedFiles} files</span>
                </div>
                <div className="pr-card__stat pr-card__stat--additions">
                  <Plus size={14} />
                  <span>{pr.additions}</span>
                </div>
                <div className="pr-card__stat pr-card__stat--deletions">
                  <Minus size={14} />
                  <span>{pr.deletions}</span>
                </div>
                <div className="pr-card__stat">
                  <GitBranch size={14} />
                  <span className="truncate">{pr.branch}</span>
                </div>
              </div>

              {pr.labels.length > 0 && (
                <div className="pr-card__labels">
                  {pr.labels.map(label => (
                    <span key={label} className="pr-card__label">{label}</span>
                  ))}
                </div>
              )}

              <div className="pr-card__action">
                <Shield size={16} />
                <span>Review with AI</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return 'just now';
}

export default PRList;
