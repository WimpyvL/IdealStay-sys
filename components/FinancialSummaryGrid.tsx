import React from 'react';
import FinancialsSummaryCard, { FinancialSummaryCardVariant } from './FinancialsSummaryCard';
import type { FinancialSummary } from '../src/services/financials.service';
import './FinancialSummaryGrid.css';

interface SummaryItem {
  key: keyof FinancialSummary;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  variant: FinancialSummaryCardVariant;
  formatter?: (value: number) => string;
}

interface FinancialSummaryGridProps {
  summary: FinancialSummary;
  icons: Record<string, React.ReactNode>;
}

const currency = (value: number): string => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const FinancialSummaryGrid: React.FC<FinancialSummaryGridProps> = ({ summary, icons }) => {
  const items: SummaryItem[] = [
    {
      key: 'grossRevenue',
      label: 'Gross Revenue',
      hint: 'Total revenue from confirmed stays',
      icon: icons.revenue,
      variant: 'mint',
    },
    {
      key: 'netPayout',
      label: 'Net Payout',
      hint: 'After platform fees and taxes',
      icon: icons.payout,
      variant: 'ocean',
    },
    {
      key: 'platformFees',
      label: 'Platform Fees',
      hint: 'Commission retained by IdealStay',
      icon: icons.fee,
      variant: 'violet',
    },
    {
      key: 'taxes',
      label: 'Tax Collected',
      hint: 'Tax obligations held for remittance',
      icon: icons.tax,
      variant: 'amber',
    },
    {
      key: 'occupancyRate',
      label: 'Occupancy Rate',
      hint: 'Last 30 days across active listings',
      icon: icons.occupancy,
      variant: 'slate',
      formatter: (value) => `${value.toFixed(1)}%`,
    },
    {
      key: 'averageDailyRate',
      label: 'Average Daily Rate',
      hint: 'Revenue per occupied night',
      icon: icons.adr,
      variant: 'mint',
    },
    {
      key: 'paidPayouts',
      label: 'Paid Payouts',
      hint: 'Total processed payouts',
      icon: icons.payout,
      variant: 'ocean',
    },
    {
      key: 'outstandingBalance',
      label: 'Outstanding Balance',
      hint: 'Completed stays awaiting disbursement',
      icon: icons.fee,
      variant: 'violet',
    },
  ];

  return (
    <section className="financial-summary-grid" aria-label="Financial summary metrics">
      {items.map(({ key, label, hint, icon, variant, formatter }) => {
        const rawValue = summary[key];
        const value = typeof rawValue === 'number' ? rawValue : 0;
        const displayValue = formatter ? formatter(value) : currency(value);

        return (
          <FinancialsSummaryCard
            key={key}
            icon={icon}
            label={label}
            hint={hint}
            value={displayValue}
            variant={variant}
          />
        );
      })}
    </section>
  );
};

export default FinancialSummaryGrid;
