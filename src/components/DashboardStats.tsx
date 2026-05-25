import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, Shield, Zap, Bug,
  Clock
} from 'lucide-react';
import type { ReviewResult } from '../types';

interface DashboardStatsProps {
  result: ReviewResult;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ result }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [animatedTotal, setAnimatedTotal] = useState(0);

  useEffect(() => {
    const scoreTimer = setInterval(() => {
      setAnimatedScore(prev => {
        if (prev >= result.qualityScore) return result.qualityScore;
        return prev + 1;
      });
    }, 20);
    
    const totalTimer = setInterval(() => {
      setAnimatedTotal(prev => {
        if (prev >= result.totalIssues) return result.totalIssues;
        return prev + 1;
      });
    }, 50);

    return () => {
      clearInterval(scoreTimer);
      clearInterval(totalTimer);
    };
  }, [result.qualityScore, result.totalIssues]);

  const scoreColor = result.qualityScore >= 80
    ? 'var(--accent-green)'
    : result.qualityScore >= 50
      ? 'var(--accent-orange)'
      : 'var(--accent-red)';

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="dashboard-stats animate-in">
      <div className="stats-grid">
        {/* Quality Score */}
        <div className="stat-card glass-card stat-card--quality">
          <div className="quality-ring">
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle
                className="quality-ring__bg"
                cx="65"
                cy="65"
                r="54"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="8"
              />
              <circle
                className="quality-ring__fill"
                cx="65"
                cy="65"
                r="54"
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 65 65)"
                style={{
                  transition: 'stroke-dashoffset 1.5s ease-out',
                  filter: `drop-shadow(0 0 8px ${scoreColor})`
                }}
              />
            </svg>
            <div className="quality-ring__text">
              <span className="quality-ring__value" style={{ color: scoreColor }}>{animatedScore}</span>
              <span className="quality-ring__label">/ 100</span>
            </div>
          </div>
          <div className="stat-card__info">
            <span className="stat-card__label">Code Quality</span>
            <span className="stat-card__verdict" style={{ color: scoreColor }}>
              {result.qualityScore >= 80 ? 'Good' : result.qualityScore >= 50 ? 'Needs Work' : 'Poor'}
            </span>
          </div>
        </div>

        {/* Total Issues */}
        <div className="stat-card glass-card stat-card--total">
          <div className="stat-card__icon-wrapper stat-card__icon-wrapper--cyan">
            <Bug size={24} />
          </div>
          <div className="stat-card__value">{animatedTotal}</div>
          <div className="stat-card__label">Total Issues</div>
        </div>

        {/* Critical */}
        <div className="stat-card glass-card stat-card--critical">
          <div className="stat-card__icon-wrapper stat-card__icon-wrapper--red">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-card__value">{result.criticalCount}</div>
          <div className="stat-card__label">Critical</div>
          <div className="stat-card__bar">
            <div
              className="stat-card__bar-fill stat-card__bar-fill--red"
              style={{ width: `${(result.criticalCount / Math.max(result.totalIssues, 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Warnings */}
        <div className="stat-card glass-card stat-card--warning">
          <div className="stat-card__icon-wrapper stat-card__icon-wrapper--orange">
            <Shield size={24} />
          </div>
          <div className="stat-card__value">{result.warningCount}</div>
          <div className="stat-card__label">Warnings</div>
          <div className="stat-card__bar">
            <div
              className="stat-card__bar-fill stat-card__bar-fill--orange"
              style={{ width: `${(result.warningCount / Math.max(result.totalIssues, 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="stat-card glass-card stat-card--info-card">
          <div className="stat-card__icon-wrapper stat-card__icon-wrapper--blue">
            <Zap size={24} />
          </div>
          <div className="stat-card__value">{result.infoCount}</div>
          <div className="stat-card__label">Info</div>
          <div className="stat-card__bar">
            <div
              className="stat-card__bar-fill stat-card__bar-fill--blue"
              style={{ width: `${(result.infoCount / Math.max(result.totalIssues, 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Time Saved */}
        <div className="stat-card glass-card stat-card--time">
          <div className="stat-card__icon-wrapper stat-card__icon-wrapper--green">
            <Clock size={24} />
          </div>
          <div className="stat-card__value">{result.estimatedTimeSaved}<span className="stat-card__unit">min</span></div>
          <div className="stat-card__label">Time Saved</div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
