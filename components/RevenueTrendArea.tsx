import React from 'react';
import type { FinancialTrendPoint } from '../src/services/financials.service';
import './RevenueTrendArea.css';

interface RevenueTrendAreaProps {
  data: FinancialTrendPoint[];
}

const formatPeriodLabel = (period: string): string => {
  const [year, month] = period.split('-');
  if (!year || !month) return period;
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
};

const RevenueTrendArea: React.FC<RevenueTrendAreaProps> = ({ data }) => {
  const maxRevenue = data.reduce((max, point) => Math.max(max, point.revenue), 0);
  const normalized = data.map((point) => ({
    ...point,
    pct: maxRevenue > 0 ? point.revenue / maxRevenue : 0,
  }));

  return (
    <section className="trend-card" aria-labelledby="trend-card-title">
      <header className="trend-card__header">
        <div>
          <h3 id="trend-card-title">12-Month Revenue Curve</h3>
          <p>Monitor revenue, tax liabilities, and ancillary fees month over month.</p>
        </div>
        <span className="trend-card__badge">{maxRevenue > 0 ? `$${maxRevenue.toLocaleString('en-US')}` : '$0'}</span>
      </header>

      <div className="trend-card__chart" role="img" aria-label="Revenue trend over the last 12 months">
        <svg viewBox="0 0 600 260" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="revenueArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(14, 165, 233, 0.4)" />
              <stop offset="80%" stopColor="rgba(14, 165, 233, 0.05)" />
            </linearGradient>
          </defs>

          <path
            className="trend-card__area"
            d={`M0,260 ${normalized
              .map((point, index) => {
                const x = (index / Math.max(normalized.length - 1, 1)) * 600;
                const y = 260 - point.pct * 220 - 20;
                return `L${x},${y}`;
              })
              .join(' ')} L600,260 Z`}
            fill="url(#revenueArea)"
          />

          {normalized.map((point, index) => {
            const x = (index / Math.max(normalized.length - 1, 1)) * 600;
            const y = 260 - point.pct * 220 - 20;
            return (
              <g key={point.period}>
                <circle className="trend-card__point" cx={x} cy={y} r={5} />
                <text className="trend-card__label" x={x} y={y - 12}>
                  ${point.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </text>
                <text className="trend-card__tick" x={x} y={260}>
                  {formatPeriodLabel(point.period)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
};

export default RevenueTrendArea;
