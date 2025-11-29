import React from 'react';
import './FinancialsSummaryCard.css';

export type FinancialSummaryCardVariant = 'mint' | 'amber' | 'ocean' | 'violet' | 'slate';

interface FinancialsSummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  variant?: FinancialSummaryCardVariant;
}

const FinancialsSummaryCard: React.FC<FinancialsSummaryCardProps> = ({
  icon,
  label,
  value,
  hint,
  variant = 'mint',
}) => {
  return (
    <article className={`financials-summary-card financials-summary-card--${variant}`} aria-live="polite">
      <div className="financials-summary-card__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="financials-summary-card__content">
        <span className="financials-summary-card__label">{label}</span>
        <span className="financials-summary-card__value">{value}</span>
        {hint ? <span className="financials-summary-card__hint">{hint}</span> : null}
      </div>
    </article>
  );
};

export default FinancialsSummaryCard;
