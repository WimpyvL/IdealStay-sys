import React, { useEffect, useMemo, useState } from 'react';
import FinancialSummaryGrid from '../components/FinancialSummaryGrid';
import TransactionHistoryTable from '../components/TransactionHistoryTable';
import PayoutScheduleCard from '../components/PayoutScheduleCard';
import ExpenseBreakdownChart from '../components/ExpenseBreakdownChart';
import AuditAlertsPanel from '../components/AuditAlertsPanel';
import RevenueTrendArea from '../components/RevenueTrendArea';
import PerformanceLeaderboard from '../components/PerformanceLeaderboard';
import Modal from '../components/Modal';
import type { Transaction } from '../types';
import './FinancialsPage.css';
import {
  DollarSignIcon,
  ReceiptTaxIcon,
  ChartBarIcon,
  CalendarIcon,
  UsersIcon,
} from '../components/icons/Icons';
import {
  financialsService,
  bookingsService,
  FinancialSummary,
  FinancialTrendPoint,
  PayoutStats,
  ExpenseBreakdown,
  PropertyPerformance,
  AuditAlert,
  MissingPaymentReference,
} from '../src/services';

type TransactionPeriod = 'all' | '30d' | '90d' | 'year';

const formatCurrency = (value: number): string =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const getPropertyInitials = (title: string): string => {
  if (!title) {
    return '🏠';
  }

  const trimmed = title.trim();
  if (!trimmed) {
    return '🏠';
  }

  const segments = trimmed.split(/\s+/);
  const first = segments[0]?.charAt(0) ?? '';
  const last = segments.length > 1 ? segments[segments.length - 1]?.charAt(0) ?? '' : '';
  const initials = `${first}${last}`.toUpperCase();

  return initials || '🏠';
};

const FinancialsPage: React.FC = () => {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<FinancialTrendPoint[]>([]);
  const [payoutStats, setPayoutStats] = useState<PayoutStats | null>(null);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdown | null>(null);
  const [propertyPerformance, setPropertyPerformance] = useState<PropertyPerformance[]>([]);
  const [auditAlerts, setAuditAlerts] = useState<AuditAlert[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionPeriod, setTransactionPeriod] = useState<TransactionPeriod>('all');
  const [loadingOverview, setLoadingOverview] = useState<boolean>(true);
  const [loadingTransactions, setLoadingTransactions] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingReport, setExportingReport] = useState<boolean>(false);
  const [downloadingLedger, setDownloadingLedger] = useState<boolean>(false);
  const [showMissingPayoutModal, setShowMissingPayoutModal] = useState<boolean>(false);
  const [missingPayoutReferences, setMissingPayoutReferences] = useState<MissingPaymentReference[]>([]);
  const [loadingAlertDetails, setLoadingAlertDetails] = useState<boolean>(false);
  const [alertDetailsError, setAlertDetailsError] = useState<string | null>(null);
  const [expandedPayoutIds, setExpandedPayoutIds] = useState<number[]>([]);
  const [payoutReferenceDrafts, setPayoutReferenceDrafts] = useState<Record<number, string>>({});
  const [payoutReferenceSaving, setPayoutReferenceSaving] = useState<Record<number, boolean>>({});
  const [payoutReferenceErrors, setPayoutReferenceErrors] = useState<Record<number, string | null>>({});
  const [payoutReferenceNotice, setPayoutReferenceNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const summaryIcons = useMemo(
    () => ({
      revenue: <DollarSignIcon />,
      payout: <ChartBarIcon />,
      fee: <ReceiptTaxIcon />,
      tax: <ReceiptTaxIcon />,
      occupancy: <UsersIcon />,
      adr: <CalendarIcon />,
    }),
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingOverview(true);
        setError(null);
        const data = await financialsService.getOverview();
        if (!mounted) return;
        setSummary(data.summary);
        setMonthlyTrend(data.monthlyTrend);
        setPayoutStats(data.payoutStats);
        setExpenseBreakdown(data.expenseBreakdown);
        setPropertyPerformance(data.propertyPerformance);
        setAuditAlerts(data.auditAlerts);
      } catch (err: unknown) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Failed to load financial overview';
        setError(message);
      } finally {
        if (mounted) setLoadingOverview(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingTransactions(true);
        const tx = await financialsService.getTransactions(transactionPeriod);
        if (!mounted) return;
        setTransactions(tx);
      } catch (err: unknown) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Failed to load transactions';
        setError(message);
      } finally {
        if (mounted) setLoadingTransactions(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [transactionPeriod]);

  const handlePeriodChange = (period: TransactionPeriod) => {
    setTransactionPeriod(period);
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleExportMonthlyReport = async () => {
    try {
      setExportingReport(true);
      setError(null);
      const blob = await financialsService.exportMonthlyReport();
      triggerDownload(blob, `financial-monthly-report-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to export monthly report';
      setError(message);
    } finally {
      setExportingReport(false);
    }
  };

  const handleDownloadLedger = async () => {
    try {
      setDownloadingLedger(true);
      setError(null);
      const blob = await financialsService.exportLedger(transactionPeriod);
      triggerDownload(blob, `financial-ledger-${transactionPeriod}-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to download ledger';
      setError(message);
    } finally {
      setDownloadingLedger(false);
    }
  };

  const handleViewAlert = async (alertId: string) => {
    if (alertId !== 'missingPaymentReference') {
      return;
    }

    setShowMissingPayoutModal(true);
    setLoadingAlertDetails(true);
    setAlertDetailsError(null);
    setMissingPayoutReferences([]);
    setExpandedPayoutIds([]);
    setPayoutReferenceNotice(null);
    setPayoutReferenceDrafts({});
    setPayoutReferenceErrors({});
    setPayoutReferenceSaving({});

    try {
      const details = await financialsService.getMissingPaymentReferences();
      setMissingPayoutReferences(details);
      const drafts: Record<number, string> = {};
      details.forEach((item) => {
        drafts[item.bookingId] = '';
      });
      setPayoutReferenceDrafts(drafts);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load payout details';
      setAlertDetailsError(message);
    } finally {
      setLoadingAlertDetails(false);
    }
  };

  const closeAlertModal = () => {
    setShowMissingPayoutModal(false);
    setAlertDetailsError(null);
    setMissingPayoutReferences([]);
    setExpandedPayoutIds([]);
    setPayoutReferenceNotice(null);
    setPayoutReferenceDrafts({});
    setPayoutReferenceErrors({});
    setPayoutReferenceSaving({});
  };

  const togglePayoutRow = (bookingId: number) => {
    setExpandedPayoutIds((prev) =>
      prev.includes(bookingId) ? prev.filter((id) => id !== bookingId) : [...prev, bookingId]
    );
  };

  const isRowExpanded = (bookingId: number): boolean => expandedPayoutIds.includes(bookingId);

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, bookingId: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      togglePayoutRow(bookingId);
    }
  };

  const handlePayoutReferenceChange = (bookingId: number, value: string) => {
    setPayoutReferenceDrafts((prev) => ({
      ...prev,
      [bookingId]: value,
    }));
    setPayoutReferenceErrors((prev) => ({
      ...prev,
      [bookingId]: null,
    }));
  };

  const handlePayoutReferenceSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
    bookingId: number
  ) => {
    event.preventDefault();
    const draft = (payoutReferenceDrafts[bookingId] ?? '').trim();

    if (!draft) {
      setPayoutReferenceErrors((prev) => ({
        ...prev,
        [bookingId]: 'Please enter a payout reference.',
      }));
      return;
    }

    setPayoutReferenceSaving((prev) => ({
      ...prev,
      [bookingId]: true,
    }));
    setPayoutReferenceNotice(null);

    try {
      await bookingsService.updatePaymentDetails(bookingId, {
        payment_reference: draft,
      });

      setMissingPayoutReferences((prev) => prev.filter((item) => item.bookingId !== bookingId));
      setExpandedPayoutIds((prev) => prev.filter((id) => id !== bookingId));
      setPayoutReferenceDrafts((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      setPayoutReferenceErrors((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      setPayoutReferenceNotice({
        type: 'success',
        text: `Payout reference saved for booking #${bookingId}.`,
      });
      setAuditAlerts((prev) =>
        prev.map((alert) =>
          alert.id === 'missingPaymentReference'
            ? { ...alert, count: Math.max(alert.count - 1, 0) }
            : alert
        )
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save payout reference';
      setPayoutReferenceErrors((prev) => ({
        ...prev,
        [bookingId]: message,
      }));
      setPayoutReferenceNotice({ type: 'error', text: message });
    } finally {
      setPayoutReferenceSaving((prev) => ({
        ...prev,
        [bookingId]: false,
      }));
    }
  };

  const isSavingPayoutReference = (bookingId: number): boolean => Boolean(payoutReferenceSaving[bookingId]);

  return (
    <div className="financials-page">
      <div className="financials-page__hero">
        <div>
          <span className="financials-page__eyebrow">Host Audit Hub</span>
          <h1>Financial Command Center</h1>
          <p>Monitor revenue, payouts, tax exposure, and audit signals in real time to keep your business compliant and profitable.</p>
        </div>
        <div className="financials-page__actions">
          <button
            type="button"
            className="financials-page__action financials-page__action--primary"
            onClick={handleExportMonthlyReport}
            disabled={exportingReport}
            aria-busy={exportingReport}
          >
            {exportingReport ? 'Exporting…' : 'Export Monthly Report'}
          </button>
          <button
            type="button"
            className="financials-page__action"
            onClick={handleDownloadLedger}
            disabled={downloadingLedger}
            aria-busy={downloadingLedger}
          >
            {downloadingLedger ? 'Preparing Ledger…' : 'Download Ledger'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="financials-page__error" role="alert">{error}</div>
      ) : null}

      {summary ? (
        <FinancialSummaryGrid summary={summary} icons={summaryIcons} />
      ) : null}

      <div className="financials-page__content-grid">
        <div className="financials-page__column">
          <RevenueTrendArea data={monthlyTrend} />
          <PerformanceLeaderboard properties={propertyPerformance} />
        </div>
        <div className="financials-page__column financials-page__column--secondary">
          {payoutStats ? <PayoutScheduleCard stats={payoutStats} /> : null}
          {expenseBreakdown ? <ExpenseBreakdownChart breakdown={expenseBreakdown} /> : null}
          <AuditAlertsPanel alerts={auditAlerts} onViewAlert={handleViewAlert} />
        </div>
      </div>

      <TransactionHistoryTable
        transactions={transactions}
        activePeriod={transactionPeriod}
        onPeriodChange={handlePeriodChange}
        loading={loadingTransactions}
      />

      {loadingOverview ? <div className="financials-page__loading">Crunching the numbers…</div> : null}

      {showMissingPayoutModal ? (
        <Modal title="Missing payout references" onClose={closeAlertModal}>
          {loadingAlertDetails ? (
            <p className="financials-page__modal-status">Gathering payout records…</p>
          ) : alertDetailsError ? (
            <div className="financials-page__modal-error" role="alert">{alertDetailsError}</div>
          ) : missingPayoutReferences.length === 0 ? (
            <p className="financials-page__modal-status">All paid bookings include payout references. 🎉</p>
          ) : (
            <div className="financials-page__modal-table-wrapper">
              {payoutReferenceNotice ? (
                <div
                  className={`financials-page__reference-notice financials-page__reference-notice--${payoutReferenceNotice.type}`}
                  role="status"
                >
                  {payoutReferenceNotice.text}
                </div>
              ) : null}
              <table className="financials-page__modal-table">
                <thead>
                  <tr>
                    <th scope="col">Booking</th>
                    <th scope="col">Property</th>
                    <th scope="col">Check-out</th>
                    <th scope="col">Paid On</th>
                    <th scope="col" className="text-right">Payout Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {missingPayoutReferences.map((item) => {
                    const expanded = isRowExpanded(item.bookingId);
                    return (
                      <React.Fragment key={item.bookingId}>
                        <tr
                          className={`financials-page__modal-row${expanded ? ' financials-page__modal-row--expanded' : ''}`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={expanded}
                          onClick={() => togglePayoutRow(item.bookingId)}
                          onKeyDown={(event) => handleRowKeyDown(event, item.bookingId)}
                        >
                          <td>
                            <span className="financials-page__modal-row-label">#{item.bookingId}</span>
                          </td>
                          <td>
                            <div className="financials-page__modal-property">
                              {item.propertyImageUrl ? (
                                <img
                                  src={item.propertyImageUrl}
                                  alt={item.propertyTitle ? `${item.propertyTitle} property photo` : 'Property photo'}
                                  className="financials-page__modal-property-image"
                                />
                              ) : (
                                <div className="financials-page__modal-property-placeholder" aria-hidden="true">
                                  {getPropertyInitials(item.propertyTitle)}
                                </div>
                              )}
                              <div className="financials-page__modal-property-info">
                                <span className="financials-page__modal-property-title">{item.propertyTitle}</span>
                              </div>
                            </div>
                          </td>
                          <td>{item.checkOutDate ? new Date(item.checkOutDate).toLocaleDateString('en-CA') : '—'}</td>
                          <td>{item.paidAt ? new Date(item.paidAt).toLocaleDateString('en-CA') : '—'}</td>
                          <td className="text-right">
                            <div className="financials-page__modal-row-value">
                              {formatCurrency(item.amount)}
                              <span className="financials-page__modal-row-caret" aria-hidden="true">
                                {expanded ? '▴' : '▾'}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="financials-page__modal-detail-row">
                            <td colSpan={5}>
                              <div className="financials-page__modal-detail">
                                  <form
                                    className="financials-page__reference-form"
                                    onSubmit={(event) => handlePayoutReferenceSubmit(event, item.bookingId)}
                                  >
                                    <label
                                      className="financials-page__reference-label"
                                      htmlFor={`payout-reference-${item.bookingId}`}
                                    >
                                      Payout reference
                                    </label>
                                    <div className="financials-page__reference-input-row">
                                      <input
                                        id={`payout-reference-${item.bookingId}`}
                                        name={`payout-reference-${item.bookingId}`}
                                        type="text"
                                        className="financials-page__reference-input"
                                        value={payoutReferenceDrafts[item.bookingId] ?? ''}
                                        onChange={(event) =>
                                          handlePayoutReferenceChange(item.bookingId, event.target.value)
                                        }
                                        placeholder="e.g. DISB-30010"
                                        disabled={isSavingPayoutReference(item.bookingId)}
                                        aria-required="true"
                                      />
                                      <button
                                        type="submit"
                                        className="financials-page__reference-button"
                                        disabled={
                                          isSavingPayoutReference(item.bookingId) ||
                                          !(payoutReferenceDrafts[item.bookingId]?.trim())
                                        }
                                        aria-busy={isSavingPayoutReference(item.bookingId)}
                                      >
                                        {isSavingPayoutReference(item.bookingId) ? 'Saving…' : 'Save reference'}
                                      </button>
                                    </div>
                                    {payoutReferenceErrors[item.bookingId] ? (
                                      <p className="financials-page__reference-error" role="alert">
                                        {payoutReferenceErrors[item.bookingId]}
                                      </p>
                                    ) : null}
                                  </form>
                                <div>
                                  <span className="financials-page__modal-detail-label">Stay window</span>
                                  <p>
                                    {item.checkInDate
                                      ? `${new Date(item.checkInDate).toLocaleDateString('en-CA')} → ${item.checkOutDate ? new Date(item.checkOutDate).toLocaleDateString('en-CA') : '—'}`
                                      : '—'}
                                  </p>
                                </div>
                                <div>
                                  <span className="financials-page__modal-detail-label">Nights / Guests</span>
                                  <p>{item.stayNights} nights · {item.guestCount} guests</p>
                                </div>
                                <div>
                                  <span className="financials-page__modal-detail-label">Booking created</span>
                                  <p>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-CA') : '—'}</p>
                                </div>
                                <div>
                                  <span className="financials-page__modal-detail-label">Payout breakdown</span>
                                  <ul className="financials-page__modal-breakdown">
                                    <li>Taxes: {formatCurrency(item.taxes)}</li>
                                    <li>Cleaning fee: {formatCurrency(item.cleaningFee)}</li>
                                    <li>Security deposit: {formatCurrency(item.securityDeposit)}</li>
                                  </ul>
                                </div>
                                <div className="financials-page__modal-detail-note">
                                  <span className="financials-page__modal-detail-label">Next step</span>
                                  <p>
                                    Add a payout reference for booking #{item.bookingId} in your finance system to
                                    reconcile the ${formatCurrency(item.amount)} disbursement.
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
};

export default FinancialsPage;
