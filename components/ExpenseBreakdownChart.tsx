import React from 'react';
import type { ExpenseBreakdown } from '../src/services/financials.service';
import './ExpenseBreakdownChart.css';

interface ExpenseBreakdownChartProps {
  breakdown: ExpenseBreakdown;
}

const formatCurrency = (value: number): string => {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
};

const chartSlices = [
  { key: 'platformFees', label: 'Platform Fees', colorClass: 'slice--mint' },
  { key: 'cleaningFees', label: 'Cleaning Fees', colorClass: 'slice--sky' },
  { key: 'taxes', label: 'Taxes', colorClass: 'slice--amber' },
  { key: 'securityDeposits', label: 'Security Deposits', colorClass: 'slice--violet' },
  { key: 'hostEarnings', label: 'Net Host Earnings', colorClass: 'slice--slate' },
] as const;

export const ExpenseBreakdownChart: React.FC<ExpenseBreakdownChartProps> = ({ breakdown }) => {
  const total = (Object.values(breakdown) as number[]).reduce((acc, value) => acc + value, 0);

  return (
    <section className="expense-chart" aria-labelledby="expense-chart-title">
      <header className="expense-chart__header">
        <div>
          <h3 id="expense-chart-title">Expense Allocation</h3>
          <p>Visual breakdown of every dollar collected versus retained.</p>
        </div>
        <span className="expense-chart__total">{formatCurrency(total)}</span>
      </header>

      <div className="expense-chart__body">
        <div className="expense-chart__donut" role="presentation" aria-hidden="true">
          {chartSlices.map(({ key, colorClass }) => {
            const value = breakdown[key];
            const percentage = total > 0 ? (value / total) * 100 : 0;
            return (
              <div
                key={key}
                className={`expense-chart__slice ${colorClass}`}
                style={{ '--slice-size': `${Math.max(percentage, 5)}%` } as React.CSSProperties}
              >
                <span className="expense-chart__slice-value">{percentage.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>

        <ul className="expense-chart__legend">
          {chartSlices.map(({ key, label, colorClass }) => (
            <li key={key} className="expense-chart__legend-item">
              <span className={`expense-chart__legend-marker ${colorClass}`} aria-hidden="true" />
              <div>
                <p className="expense-chart__legend-label">{label}</p>
                <p className="expense-chart__legend-value">{formatCurrency(breakdown[key])}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default ExpenseBreakdownChart;
