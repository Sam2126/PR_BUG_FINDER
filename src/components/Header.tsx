import React, { useState } from 'react';
import {
  Zap, Link2, Eye, EyeOff, Sparkles, GitFork,
  ArrowRight, Cpu, Shield, CheckCircle2, Brain
} from 'lucide-react';
import type { ConnectionConfig } from '../types';

interface HeaderProps {
  config: ConnectionConfig;
  onConfigChange: (config: ConnectionConfig) => void;
  onConnect: () => void;
  onDemo: () => void;
  isConnected: boolean;
  step: string;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  step
}) => {
  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__logo" onClick={() => window.location.reload()}>
          <div className="header__logo-icon">
            <Cpu size={24} />
          </div>
          <div className="header__logo-text">
            <span className="text-gradient">CodeLens</span>
            <span className="header__logo-ai">AI</span>
          </div>
        </div>

        <nav className="header__nav">
          {step !== 'idle' && (
            <div className="header__step-indicator">
              <StepDot active={step === 'connecting'} done={['fetching','analyzing','complete'].includes(step)} label="Connect" />
              <div className="header__step-line" />
              <StepDot active={step === 'fetching'} done={['analyzing','complete'].includes(step)} label="Fetch" />
              <div className="header__step-line" />
              <StepDot active={step === 'analyzing'} done={step === 'complete'} label="Agent" />
              <div className="header__step-line" />
              <StepDot active={false} done={step === 'complete'} label="Review" />
            </div>
          )}
        </nav>

        <div className="header__right">
          {isConnected && (
            <div className="header__status">
              <div className="header__status-dot header__status-dot--connected" />
              <span>Connected</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const StepDot: React.FC<{ active: boolean; done: boolean; label: string }> = ({ active, done, label }) => (
  <div className={`header__step ${active ? 'header__step--active' : ''} ${done ? 'header__step--done' : ''}`}>
    {done ? <CheckCircle2 size={16} /> : <div className={`header__step-dot ${active ? 'header__step-dot--active' : ''}`} />}
    <span>{label}</span>
  </div>
);


interface LandingProps {
  config: ConnectionConfig;
  onConfigChange: (config: ConnectionConfig) => void;
  onConnect: () => void;
  onDemo: () => void;
  error: string | null;
}

export const Landing: React.FC<LandingProps> = ({
  config, onConfigChange, onConnect, onDemo, error
}) => {
  const [showToken, setShowToken] = useState(false);


  const canConnect = config.owner && config.repo && config.githubToken;

  return (
    <div className="landing">
      <div className="landing__hero animate-in">
        <div className="landing__icon-ring">
          <div className="landing__icon-ring-inner">
            <Shield size={48} className="text-cyan" />
          </div>
        </div>
        <h1 className="landing__title">
          <span className="text-gradient">CodeLens</span> AI
        </h1>
        <p className="landing__subtitle">
          An autonomous AI Agent that reviews pull requests in real-time,
          detects bugs, security vulnerabilities, and performance bottlenecks,
          then generates actionable review comments automatically.
        </p>
      </div>

      <div className="landing__features animate-in" style={{ animationDelay: '0.1s' }}>
        <div className="landing__feature">
          <Shield size={20} className="text-red" />
          <span>Security Scanning</span>
        </div>
        <div className="landing__feature">
          <Zap size={20} className="text-orange" />
          <span>Performance Analysis</span>
        </div>
        <div className="landing__feature">
          <Brain size={20} className="text-violet" />
          <span>AI Agent Reasoning</span>
        </div>
      </div>

      <div className="landing__form glass-card animate-in" style={{ animationDelay: '0.2s' }}>
        <h3 className="landing__form-title">
          <GitFork size={20} />
          Connect GitHub Repository
        </h3>

        <div className="input-row">
          <div className="input-group">
            <label>Repository Owner</label>
            <input
              className="input"
              placeholder="e.g., facebook"
              value={config.owner}
              onChange={e => onConfigChange({ ...config, owner: e.target.value })}
            />
          </div>
          <div className="input-group">
            <label>Repository Name</label>
            <input
              className="input"
              placeholder="e.g., react"
              value={config.repo}
              onChange={e => onConfigChange({ ...config, repo: e.target.value })}
            />
          </div>
        </div>

        <div className="input-group">
          <label>GitHub Personal Access Token</label>
          <div className="input-with-toggle">
            <input
              className="input"
              type={showToken ? 'text' : 'password'}
              placeholder="ghp_xxxxxxxxxxxx"
              value={config.githubToken}
              onChange={e => onConfigChange({ ...config, githubToken: e.target.value })}
            />
            <button className="input-toggle" onClick={() => setShowToken(!showToken)}>
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="landing__integrated-badge">
          <Cpu size={16} />
          <span>Gemini 2.0 Flash — Integrated</span>
        </div>

        {error && (
          <div className="landing__error">
            <span>{error}</span>
          </div>
        )}

        <button
          className="btn btn-primary btn-lg landing__connect-btn"
          onClick={onConnect}
          disabled={!canConnect}
        >
          <Link2 size={18} />
          Connect & Fetch PRs
          <ArrowRight size={18} />
        </button>

        <div className="landing__divider">
          <span>or</span>
        </div>

        <button className="btn btn-secondary btn-lg landing__demo-btn" onClick={onDemo}>
          <Sparkles size={18} />
          Try Interactive Demo
          <ArrowRight size={18} />
        </button>
        <p className="landing__demo-hint">
          Experience a full demo with realistic mock data — no API keys needed
        </p>
      </div>
    </div>
  );
};

export default Header;
