import React, { useState } from 'react';
import type { Transaction } from '../types';
import './TransactionHistoryTable.css';

type TransactionPeriod = 'all' | '30d' | '90d' | 'year';

interface TransactionHistoryTableProps {
  transactions: Transaction[];
  activePeriod: TransactionPeriod;
  onPeriodChange: (period: TransactionPeriod) => void;
  loading?: boolean;
}

const periodLabels: Record<TransactionPeriod, string> = {
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
  year: 'Last 12 Months',
  all: 'All Time',
};

const TransactionHistoryTable: React.FC<TransactionHistoryTableProps> = ({
  transactions,
  activePeriod,
  onPeriodChange,
  loading = false,
}) => {
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  const toggleRow = (id: number) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((txId) => txId !== id) : [...prev, id]
    );
  };

  const isExpanded = (id: number): boolean => expandedIds.includes(id);

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, id: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleRow(id);
    }
  };

  const getStatusChip = (status: string) => {
    const statusClass = (status || '').toLowerCase();
    return <span className={`status-chip status-chip--${statusClass}`}>{status || '—'}</span>;
  };

  const getTransactionIcon = (type: string) => {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'booking':
        return <span className="transaction-icon transaction-icon--green">+</span>;
      case 'payout':
        return <span className="transaction-icon transaction-icon--violet">🏦</span>;
      case 'refund':
        return <span className="transaction-icon transaction-icon--amber">↩️</span>;
      case 'fee':
        return <span className="transaction-icon transaction-icon--slate">🧾</span>;
      default:
        return <span className="transaction-icon transaction-icon--slate">?</span>;
    }
  };

  return (
    <section className="transaction-history" aria-live="polite">
      <div className="transaction-history__header">
        <div>
          <h3 className="transaction-history__title">Transaction Ledger</h3>
          <p className="transaction-history__subtitle">Track every booking, payout, and adjustment across your portfolio.</p>
        </div>
        <div className="transaction-history__filters" role="group" aria-label="Filter transactions by period">
          {(Object.keys(periodLabels) as TransactionPeriod[]).map((period) => (
            <button
              key={period}
              type="button"
              className={`transaction-history__filter${activePeriod === period ? ' transaction-history__filter--active' : ''}`}
              onClick={() => onPeriodChange(period)}
              aria-pressed={activePeriod === period}
            >
              {periodLabels[period]}
            </button>
          ))}
        </div>
      </div>

      <div className="transaction-history__table-wrapper">
        <table className="transaction-history__table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Type</th>
              <th scope="col">Details</th>
              <th scope="col" className="text-right">Amount</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, index) => (
                <tr key={`skeleton-${index}`} className="transaction-history__skeleton-row" aria-hidden="true">
                  <td><span className="skeleton-line skeleton-line--short" /></td>
                  <td><span className="skeleton-line skeleton-line--pill" /></td>
                  <td><span className="skeleton-line" /></td>
                  <td className="text-right"><span className="skeleton-line skeleton-line--short" /></td>
                  <td><span className="skeleton-line skeleton-line--pill" /></td>
                </tr>
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="transaction-history__empty">No transactions found for this period.</td>
              </tr>
            ) : (
              transactions.map((transaction) => {
                const expanded = isExpanded(transaction.id);
                return (
                  <React.Fragment key={transaction.id}>
                    <tr
                      className={`transaction-history__row${expanded ? ' transaction-history__row--expanded' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      onClick={() => toggleRow(transaction.id)}
                      onKeyDown={(event) => handleRowKeyDown(event, transaction.id)}
                    >
                      <td>{new Date(transaction.date).toLocaleDateString('en-CA')}</td>
                      <td className="transaction-history__type-cell">
                        {getTransactionIcon(transaction.type)}
                        <span className="transaction-history__type-label">{transaction.type}</span>
                      </td>
                      <td>
                        <div className="transaction-history__details">
                          <span>{transaction.property_title || transaction.description || ''}</span>
                          <span className="transaction-history__expand-caret" aria-hidden="true">
                            {expanded ? '▴' : '▾'}
                          </span>
                        </div>
                      </td>
                      <td className={`text-right ${transaction.amount < 0 ? 'amount-negative' : 'amount-positive'}`}>
                        {transaction.amount < 0 ? '-' : ''}${Math.abs(transaction.amount).toFixed(2)}
                      </td>
                      <td>{getStatusChip(transaction.status)}</td>
                    </tr>
                    {expanded && (
                      <tr className="transaction-history__detail-row">
                        <td colSpan={5}>
                          <div className="transaction-history__detail-content">
                            <div className="transaction-history__detail-section">
                              <span className="transaction-history__detail-label">Booking ID</span>
                              <p>#{transaction.id}</p>
                            </div>
                            <div className="transaction-history__detail-section">
                              <span className="transaction-history__detail-label">Transaction Date</span>
                              <p>{new Date(transaction.date).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}</p>
                            </div>
                            <div className="transaction-history__detail-section">
                              <span className="transaction-history__detail-label">Type</span>
                              <p className="transaction-history__detail-type">{transaction.type}</p>
                            </div>
                            <div className="transaction-history__detail-section">
                              <span className="transaction-history__detail-label">Status</span>
                              <p>{getStatusChip(transaction.status)}</p>
                            </div>
                            <div className="transaction-history__detail-section transaction-history__detail-section--full">
                              <span className="transaction-history__detail-label">Description</span>
                              <p>{transaction.description || 'No additional details available.'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default TransactionHistoryTable;
