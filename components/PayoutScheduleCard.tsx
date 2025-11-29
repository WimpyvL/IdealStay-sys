import React from 'react';
import type { PayoutStats } from '../src/services/financials.service';
import './PayoutScheduleCard.css';

interface PayoutScheduleCardProps {
  stats: PayoutStats;
}

export const PayoutScheduleCard: React.FC<PayoutScheduleCardProps> = ({ stats }) => {
  const { pendingTotal, upcomingTotal, upcomingPayouts, lastPayout } = stats;

  return (
    <section className="payout-card" aria-labelledby="payout-card-title">
      <header className="payout-card__header">
        <div>
          <h3 id="payout-card-title">Payout Schedule</h3>
          <p>Your upcoming disbursements across confirmed and completed stays.</p>
        </div>
        <div className="payout-card__badge" aria-label="Pending disbursements">
          <span>Outstanding</span>
          <strong>${pendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
        </div>
      </header>

      <div className="payout-card__grid">
        <div className="payout-card__metric">
          <span className="payout-card__metric-label">Upcoming Payouts</span>
          <span className="payout-card__metric-value">${upcomingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span className="payout-card__metric-hint">Next 21 days</span>
        </div>
        <div className="payout-card__metric">
          <span className="payout-card__metric-label">Last Payout</span>
          {lastPayout ? (
            <div className="payout-card__metric-last">
              <span className="payout-card__metric-value">${lastPayout.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span className="payout-card__metric-hint">
                {new Date(lastPayout.processedAt).toLocaleDateString('en-CA')} • {lastPayout.propertyTitle}
              </span>
            </div>
          ) : (
            <span className="payout-card__metric-hint">No payouts processed yet</span>
          )}
        </div>
      </div>

      <div className="payout-card__list" role="list" aria-label="Upcoming payouts">
        {upcomingPayouts.length === 0 ? (
          <div className="payout-card__empty">No upcoming disbursements scheduled.</div>
        ) : (
          upcomingPayouts.slice(0, 4).map((payout) => (
            <div key={payout.bookingId} className="payout-card__item" role="listitem">
              <div>
                <p className="payout-card__item-title">{payout.propertyTitle}</p>
                <p className="payout-card__item-dates">
                  {new Date(payout.checkInDate).toLocaleDateString('en-CA')} →
                  {` ${new Date(payout.checkOutDate).toLocaleDateString('en-CA')}`}
                </p>
              </div>
              <span className="payout-card__item-amount">${payout.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default PayoutScheduleCard;
