import React, { useEffect, useRef } from 'react';
import {
  Brain, Wrench, Eye, GitCompare, Scale, Zap, CheckCircle2,
  AlertCircle, Loader2, Terminal, Search, Clock,
  Shield, Bug, ChevronRight, FileCode2
} from 'lucide-react';
import type { AgentStep, AgentPlan } from '../types/index';

interface AgentThinkingProps {
  steps: AgentStep[];
  plan: AgentPlan | null;
  isRunning: boolean;
}

function getStepIcon(type: string, title: string) {
  switch (type) {
    case 'planning': return <Terminal size={14} />;
    case 'thinking': return <Clock size={14} />;
    case 'tool_call': return <Wrench size={14} />;
    case 'observation':
      if (title.includes('🔴')) return <AlertCircle size={14} />;
      if (title.includes('🟡')) return <Shield size={14} />;
      if (title.includes('✅')) return <CheckCircle2 size={14} />;
      return <Eye size={14} />;
    case 'cross_reference': return <GitCompare size={14} />;
    case 'decision': return <Scale size={14} />;
    case 'action': return <Zap size={14} />;
    case 'complete': return <CheckCircle2 size={14} />;
    case 'error': return <Bug size={14} />;
    default: return <Search size={14} />;
  }
}

function getStepClass(type: string, title: string): string {
  if (type === 'observation') {
    if (title.includes('🔴')) return 'agent-step--observation-critical';
    if (title.includes('🟡')) return 'agent-step--observation-warning';
    if (title.includes('✅')) return 'agent-step--observation-clean';
  }
  if (type === 'thinking' && (title.includes('Rate') || title.includes('⏳'))) {
    return 'agent-step--rate-limit';
  }
  if (type === 'error') return 'agent-step--error';
  return `agent-step--${type}`;
}

/** Render step content. Splits bullet-point lines into a proper list. */
function renderContent(content: string, type: string) {
  // For observation steps, split issue bullets into a real list
  if (type === 'observation' && content.includes('•')) {
    const items = content
      .split('•')
      .map(s => s.trim())
      .filter(Boolean);

    return (
      <ul className="agent-step__issue-list">
        {items.map((item, i) => {
          let cls = 'agent-step__issue-item';
          if (item.startsWith('[CRITICAL]')) cls += ' agent-step__issue-item--critical';
          else if (item.startsWith('[WARNING]')) cls += ' agent-step__issue-item--warning';
          else if (item.startsWith('[INFO]')) cls += ' agent-step__issue-item--info';
          else if (item.startsWith('[SUGGESTION]')) cls += ' agent-step__issue-item--suggestion';
          return <li key={i} className={cls}>{item}</li>;
        })}
      </ul>
    );
  }

  return <p className="agent-step__text">{content}</p>;
}

export const AgentThinking: React.FC<AgentThinkingProps> = ({ steps, plan, isRunning }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new steps arrive
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [steps]);

  // Count total issues found so far
  const totalIssues = steps.reduce((sum, s) => sum + (s.issuesFound ?? 0), 0);
  const filesAnalyzed = steps.filter(s => s.type === 'observation').length;

  return (
    <div className="agent-panel">
      {/* Terminal-style header */}
      <div className="agent-panel__header">
        <div className="agent-panel__dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="agent-panel__title">
          <Brain size={14} />
          AI Agent Reasoning
        </div>
        <div className="agent-panel__header-right">
          {totalIssues > 0 && (
            <span className="agent-panel__counter">
              <AlertCircle size={12} />
              {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
            </span>
          )}
          <div className={`agent-panel__status ${isRunning ? 'agent-panel__status--running' : 'agent-panel__status--complete'}`}>
            {isRunning && <span className="agent-panel__status-dot"></span>}
            {isRunning ? `Analyzing file ${filesAnalyzed + 1}...` : steps.length > 0 ? '✓ Complete' : 'Waiting'}
          </div>
        </div>
      </div>

      {/* Agent Plan */}
      {plan && (
        <div className="agent-panel__plan">
          <div className="agent-panel__plan-header">
            <Terminal size={14} />
            Strategy: {plan.strategy}
          </div>
          <div className="agent-panel__plan-steps">
            {plan.steps.map((s, i) => (
              <span
                key={i}
                className={`agent-panel__plan-step ${
                  i < plan.currentStep
                    ? 'agent-panel__plan-step--done'
                    : i === plan.currentStep
                    ? 'agent-panel__plan-step--active'
                    : ''
                }`}
              >
                {i < plan.currentStep ? (
                  <CheckCircle2 size={10} />
                ) : i === plan.currentStep ? (
                  <Loader2 size={10} className="agent-step__spinner-icon" />
                ) : (
                  <ChevronRight size={10} />
                )}
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Agent Steps */}
      <div className="agent-panel__content" ref={contentRef}>
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`agent-step ${getStepClass(step.type, step.title)}`}
            style={{ animationDelay: `${index * 0.03}s` }}
          >
            <div className="agent-step__icon">
              {step.status === 'running' ? (
                <Loader2 size={14} className="agent-step__spinner-icon" />
              ) : (
                getStepIcon(step.type, step.title)
              )}
            </div>
            <div className="agent-step__body">
              <div className="agent-step__title">{step.title}</div>
              
              {/* Tool call badge */}
              {step.tool && (
                <div className="agent-step__tool">
                  <span className="agent-step__tool-name">
                    <Wrench size={10} />
                    {step.tool}()
                  </span>
                </div>
              )}

              {/* Step content — rendered as list for observations */}
              {renderContent(step.content, step.type)}

              {/* Meta info */}
              <div className="agent-step__meta">
                {step.fileContext && (
                  <span className="agent-step__file">
                    <FileCode2 size={10} />
                    {step.fileContext}
                  </span>
                )}
                {step.issuesFound !== undefined && step.issuesFound > 0 && (
                  <span className="agent-step__issues">
                    <AlertCircle size={10} />
                    {step.issuesFound} issue{step.issuesFound > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Running spinner */}
        {isRunning && (
          <div className="agent-step__spinner">
            <Loader2 size={16} />
            <span>Agent is analyzing...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentThinking;
