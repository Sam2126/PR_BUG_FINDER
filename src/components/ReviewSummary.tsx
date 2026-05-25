import React from 'react';
import {
  CheckCircle2, XCircle, MessageCircle, AlertTriangle,
  Shield, Send, GitFork, FileText
} from 'lucide-react';
import type { ReviewResult } from '../types';

interface ReviewSummaryProps {
  result: ReviewResult;
  onPostToGithub: () => void;
  isDemo: boolean;
}

const VERDICT_CONFIG = {
  'approve': {
    icon: <CheckCircle2 size={24} />,
    label: 'Approve',
    className: 'review-summary__verdict--approve',
    text: 'This pull request looks good with minor suggestions.',
  },
  'request-changes': {
    icon: <XCircle size={24} />,
    label: 'Request Changes',
    className: 'review-summary__verdict--changes',
    text: 'Critical issues found that must be addressed before merging.',
  },
  'comment': {
    icon: <MessageCircle size={24} />,
    label: 'Comment',
    className: 'review-summary__verdict--comment',
    text: 'Some improvements suggested but no blockers.',
  },
};

export const ReviewSummary: React.FC<ReviewSummaryProps> = ({ result, onPostToGithub, isDemo }) => {
  const verdict = VERDICT_CONFIG[result.recommendation];

  return (
    <div className="review-summary glass-card animate-in">
      <div className="review-summary__header">
        <h3 className="review-summary__title">
          <FileText size={20} className="text-cyan" />
          AI Review Summary
        </h3>
        <div className={`review-summary__verdict ${verdict.className}`}>
          {verdict.icon}
          <span>{verdict.label}</span>
        </div>
      </div>

      <div className="review-summary__body">
        <p className="review-summary__text">{result.summary}</p>

        <div className="review-summary__breakdown">
          <h4>Issue Breakdown</h4>
          <div className="review-summary__bars">
            {result.criticalCount > 0 && (
              <div className="review-summary__bar-row">
                <span className="review-summary__bar-label">
                  <AlertTriangle size={14} className="text-red" />
                  Critical
                </span>
                <div className="review-summary__bar">
                  <div
                    className="review-summary__bar-fill review-summary__bar-fill--critical"
                    style={{ width: `${(result.criticalCount / result.totalIssues) * 100}%` }}
                  />
                </div>
                <span className="review-summary__bar-count">{result.criticalCount}</span>
              </div>
            )}
            {result.warningCount > 0 && (
              <div className="review-summary__bar-row">
                <span className="review-summary__bar-label">
                  <Shield size={14} className="text-orange" />
                  Warning
                </span>
                <div className="review-summary__bar">
                  <div
                    className="review-summary__bar-fill review-summary__bar-fill--warning"
                    style={{ width: `${(result.warningCount / result.totalIssues) * 100}%` }}
                  />
                </div>
                <span className="review-summary__bar-count">{result.warningCount}</span>
              </div>
            )}
            {result.infoCount > 0 && (
              <div className="review-summary__bar-row">
                <span className="review-summary__bar-label">
                  <MessageCircle size={14} className="text-blue" />
                  Info
                </span>
                <div className="review-summary__bar">
                  <div
                    className="review-summary__bar-fill review-summary__bar-fill--info"
                    style={{ width: `${(result.infoCount / result.totalIssues) * 100}%` }}
                  />
                </div>
                <span className="review-summary__bar-count">{result.infoCount}</span>
              </div>
            )}
            {result.suggestionCount > 0 && (
              <div className="review-summary__bar-row">
                <span className="review-summary__bar-label">
                  <CheckCircle2 size={14} className="text-green" />
                  Suggestions
                </span>
                <div className="review-summary__bar">
                  <div
                    className="review-summary__bar-fill review-summary__bar-fill--suggestion"
                    style={{ width: `${(result.suggestionCount / result.totalIssues) * 100}%` }}
                  />
                </div>
                <span className="review-summary__bar-count">{result.suggestionCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="review-summary__actions">
        <button className="btn btn-primary" onClick={onPostToGithub}>
          <GitFork size={16} />
          {isDemo ? 'Post to GitHub (Demo)' : 'Post Review to GitHub'}
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default ReviewSummary;
