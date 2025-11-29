import React from 'react';
import type { AuditAlert } from '../src/services/financials.service';
import './AuditAlertsPanel.css';

interface AuditAlertsPanelProps {
  alerts: AuditAlert[];
  onViewAlert?: (alertId: AuditAlert['id']) => void;
}

const severityLabels: Record<AuditAlert['severity'], string> = {
  high: 'High risk',
  medium: 'Needs attention',
  low: 'Monitor',
};

export const AuditAlertsPanel: React.FC<AuditAlertsPanelProps> = ({ alerts, onViewAlert }) => {
  return (
    <section className="audit-alerts" aria-labelledby="audit-alerts-title">
      <header className="audit-alerts__header">
        <div>
          <h3 id="audit-alerts-title">Audit Alerts</h3>
          <p>Resolve outstanding discrepancies before they impact payouts.</p>
        </div>
        <span className="audit-alerts__count" aria-label="Open audit items">
          {alerts.length} open
        </span>
      </header>

      {alerts.length === 0 ? (
        <div className="audit-alerts__empty">
          <strong>All clear.</strong>
          <p>We’re not detecting any payout issues right now.</p>
        </div>
      ) : (
        <ul className="audit-alerts__list">
          {alerts.map((alert) => (
            <li key={alert.id} className={`audit-alerts__item audit-alerts__item--${alert.severity}`}>
              <div>
                <h4>{alert.label}</h4>
                <p>{severityLabels[alert.severity]}</p>
              </div>
              <div className="audit-alerts__meta">
                <span className="audit-alerts__badge">{alert.count}</span>
                {onViewAlert && alert.id === 'missingPaymentReference' ? (
                  <button
                    type="button"
                    className="audit-alerts__action"
                    onClick={() => onViewAlert(alert.id)}
                  >
                    View details
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default AuditAlertsPanel;
