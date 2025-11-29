import React from 'react';
import type { PropertyPerformance } from '../src/services/financials.service';
import './PerformanceLeaderboard.css';

interface PerformanceLeaderboardProps {
  properties: PropertyPerformance[];
}

const PerformanceLeaderboard: React.FC<PerformanceLeaderboardProps> = ({ properties }) => {
  return (
    <section className="performance-board" aria-labelledby="performance-board-title">
      <header className="performance-board__header">
        <div>
          <h3 id="performance-board-title">Top Performing Stays</h3>
          <p>Compare revenue performance, nightly rates, and cancellations.</p>
        </div>
      </header>

      <div className="performance-board__table-wrapper">
        <table className="performance-board__table">
          <thead>
            <tr>
              <th scope="col">Property</th>
              <th scope="col" className="text-right">Revenue</th>
              <th scope="col" className="text-right">Nights</th>
              <th scope="col" className="text-right">Bookings</th>
              <th scope="col" className="text-right">Cancellations</th>
              <th scope="col" className="text-right">Average Daily Rate</th>
            </tr>
          </thead>
          <tbody>
            {properties.length === 0 ? (
              <tr>
                <td colSpan={6} className="performance-board__empty">No property performance data available.</td>
              </tr>
            ) : (
              properties.map((property) => (
                <tr key={property.propertyId}>
                  <td>
                    <strong>{property.propertyTitle}</strong>
                  </td>
                  <td className="text-right">${property.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="text-right">{property.nights}</td>
                  <td className="text-right">{property.bookings}</td>
                  <td className="text-right">{property.cancellations}</td>
                  <td className="text-right">${property.averageDailyRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default PerformanceLeaderboard;
