import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { getPool } from '../config/database';

const PLATFORM_FEE_RATE = 0.12; // 12% platform commission assumption

const toNumber = (value: unknown, precision: number = 2): number => {
  const num = value === null || value === undefined ? 0 : Number(value);
  if (Number.isNaN(num)) {
    return 0;
  }
  return precision >= 0 ? parseFloat(num.toFixed(precision)) : num;
};

const escapeCsvValue = (value: unknown): string => {
  const raw = value === null || value === undefined ? '' : String(value);
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

const buildCsv = (headers: string[], rows: Array<Array<unknown>>): string => {
  const csvLines = [headers.map(escapeCsvValue).join(',')];
  for (const row of rows) {
    csvLines.push(row.map(escapeCsvValue).join(','));
  }
  return csvLines.join('\n');
};

const getPeriodClause = (period: string): string => {
  switch (period) {
    case '30d':
      return 'AND b.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)';
    case '90d':
      return 'AND b.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)';
    case 'year':
      return 'AND b.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY)';
    default:
      return '';
  }
};

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    [key: string]: unknown;
  };
}

export const getFinancials = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const pool = getPool();
    const hostId = req.user?.id;

    if (!hostId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const [summaryRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('confirmed','completed') THEN total_amount ELSE 0 END), 0) AS grossRevenue,
         COALESCE(SUM(CASE WHEN status IN ('confirmed','completed') THEN taxes ELSE 0 END), 0) AS totalTaxes,
         COALESCE(SUM(CASE WHEN status IN ('confirmed','completed') THEN cleaning_fee ELSE 0 END), 0) AS cleaningFees,
         COALESCE(SUM(CASE WHEN status IN ('confirmed','completed') THEN security_deposit ELSE 0 END), 0) AS securityDeposits,
         COALESCE(SUM(CASE WHEN status IN ('completed') AND payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS paidPayouts,
         COALESCE(SUM(CASE WHEN status IN ('completed') AND payment_status IN ('pending','partial') THEN total_amount ELSE 0 END), 0) AS outstandingBalance,
         COUNT(CASE WHEN status IN ('confirmed','completed') THEN 1 END) AS completedBookings,
         COALESCE(SUM(CASE WHEN status IN ('confirmed','completed') THEN DATEDIFF(check_out_date, check_in_date) ELSE 0 END), 0) AS bookedNights
       FROM bookings
       WHERE host_id = ?`,
      [hostId]
    );

    const summaryRow = summaryRows[0] || {};
    const grossRevenue = toNumber(summaryRow.grossRevenue);
    const taxes = toNumber(summaryRow.totalTaxes);
    const cleaningFees = toNumber(summaryRow.cleaningFees);
    const securityDeposits = toNumber(summaryRow.securityDeposits);
    const paidPayouts = toNumber(summaryRow.paidPayouts);
    const outstandingBalance = toNumber(summaryRow.outstandingBalance);
    const completedBookings = Number(summaryRow.completedBookings) || 0;
    const bookedNights = Number(summaryRow.bookedNights) || 0;

    const platformFees = toNumber(grossRevenue * PLATFORM_FEE_RATE);
    const netPayout = toNumber(grossRevenue - platformFees - taxes);
    const averageDailyRate = bookedNights > 0 ? toNumber(grossRevenue / bookedNights) : 0;

    const [propertyRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS activeProperties
       FROM properties
       WHERE host_id = ? AND status IN ('active','pending')`,
      [hostId]
    );
    const activeProperties = Number(propertyRows[0]?.activeProperties) || 0;

    const [recentNightsRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(DATEDIFF(check_out_date, check_in_date)), 0) AS recentNights
       FROM bookings
       WHERE host_id = ?
         AND status IN ('confirmed','completed')
         AND check_in_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)`,
      [hostId]
    );
    const recentNights = Number(recentNightsRows[0]?.recentNights) || 0;
    const occupancyRate = activeProperties > 0
      ? toNumber((recentNights / (activeProperties * 30)) * 100, 1)
      : 0;

    const [upcomingRows] = await pool.execute<RowDataPacket[]>(
      `SELECT b.id, b.total_amount, b.check_in_date, b.check_out_date, p.title AS property_title
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       WHERE b.host_id = ?
         AND b.status = 'confirmed'
         AND b.check_out_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 21 DAY)
       ORDER BY b.check_out_date ASC
       LIMIT 10`,
      [hostId]
    );
    const upcomingPayouts = upcomingRows.map(row => ({
      bookingId: row.id,
      propertyTitle: row.property_title,
      amount: toNumber(row.total_amount),
      checkInDate: row.check_in_date,
      checkOutDate: row.check_out_date
    }));
    const upcomingTotal = upcomingPayouts.reduce((sum, payout) => sum + payout.amount, 0);

    const [pendingRows] = await pool.execute<RowDataPacket[]>(
      `SELECT b.id, b.total_amount, b.check_out_date, p.title AS property_title
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       WHERE b.host_id = ?
         AND b.status = 'completed'
         AND b.payment_status IN ('pending','partial')
       ORDER BY b.check_out_date ASC`,
      [hostId]
    );
    const pendingTotal = pendingRows.reduce((sum, row) => sum + toNumber(row.total_amount), 0);

    const [lastPayoutRows] = await pool.execute<RowDataPacket[]>(
      `SELECT b.id, b.total_amount, b.updated_at, p.title AS property_title
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       WHERE b.host_id = ?
         AND b.status = 'completed'
         AND b.payment_status = 'paid'
       ORDER BY b.updated_at DESC
       LIMIT 1`,
      [hostId]
    );
    const lastPayout = lastPayoutRows[0]
      ? {
          bookingId: lastPayoutRows[0].id,
          propertyTitle: lastPayoutRows[0].property_title,
          amount: toNumber(lastPayoutRows[0].total_amount),
          processedAt: lastPayoutRows[0].updated_at,
        }
      : null;

    const expenseBreakdown = {
      platformFees,
      cleaningFees,
      taxes,
      securityDeposits,
      hostEarnings: netPayout,
    };

    const [trendRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         DATE_FORMAT(created_at, '%Y-%m') AS period,
         COALESCE(SUM(total_amount), 0) AS revenue,
         COALESCE(SUM(taxes), 0) AS taxes,
         COALESCE(SUM(cleaning_fee), 0) AS cleaningFees,
         COUNT(*) AS bookings
       FROM bookings
       WHERE host_id = ?
         AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
       GROUP BY period
       ORDER BY period`,
      [hostId]
    );
    const monthlyTrend = trendRows.map(row => ({
      period: row.period,
      revenue: toNumber(row.revenue),
      taxes: toNumber(row.taxes),
      cleaningFees: toNumber(row.cleaningFees),
      bookings: Number(row.bookings) || 0,
    }));

    const [propertyPerformanceRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         p.id,
         p.title,
         COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.total_amount ELSE 0 END), 0) AS revenue,
         COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN DATEDIFF(b.check_out_date, b.check_in_date) ELSE 0 END), 0) AS nights,
         COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN 1 ELSE 0 END), 0) AS bookings,
         COALESCE(SUM(CASE WHEN b.status IN ('cancelled','refunded') THEN 1 ELSE 0 END), 0) AS cancellations
       FROM properties p
       LEFT JOIN bookings b ON b.property_id = p.id
       WHERE p.host_id = ?
       GROUP BY p.id, p.title
       ORDER BY revenue DESC
       LIMIT 5`,
      [hostId]
    );
    const propertyPerformance = propertyPerformanceRows.map(row => {
      const nights = Number(row.nights) || 0;
      const revenue = toNumber(row.revenue);
      return {
        propertyId: row.id,
        propertyTitle: row.title,
        revenue,
        nights,
        bookings: Number(row.bookings) || 0,
        cancellations: Number(row.cancellations) || 0,
        averageDailyRate: nights > 0 ? toNumber(revenue / nights) : 0,
      };
    });

    const [alertRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         SUM(CASE WHEN status = 'completed' AND payment_status IN ('pending','partial') AND check_out_date < DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS overduePayouts,
         SUM(CASE WHEN payment_status = 'paid' AND (payment_reference IS NULL OR payment_reference = '') THEN 1 ELSE 0 END) AS missingPaymentReference,
         SUM(CASE WHEN status = 'refunded' AND (cancellation_reason IS NULL OR cancellation_reason = '') THEN 1 ELSE 0 END) AS refundsWithoutReason
       FROM bookings
       WHERE host_id = ?`,
      [hostId]
    );
    const alertRow = alertRows[0] || {};
    const auditAlerts = [
      {
        id: 'overduePayouts',
        label: 'Overdue payouts',
        count: Number(alertRow.overduePayouts) || 0,
        severity: 'high' as const,
      },
      {
        id: 'missingPaymentReference',
        label: 'Missing payout references',
        count: Number(alertRow.missingPaymentReference) || 0,
        severity: 'medium' as const,
      },
      {
        id: 'refundsWithoutReason',
        label: 'Refunds without notes',
        count: Number(alertRow.refundsWithoutReason) || 0,
        severity: 'low' as const,
      },
    ].filter(alert => alert.count > 0);

    res.json({
      success: true,
      data: {
        summary: {
          grossRevenue,
          platformFees,
          taxes,
          netPayout,
          paidPayouts,
          outstandingBalance,
          completedBookings,
          bookedNights,
          averageDailyRate,
          occupancyRate,
        },
        payoutStats: {
          pendingTotal: toNumber(pendingTotal),
          upcomingTotal: toNumber(upcomingTotal),
          upcomingPayouts,
          lastPayout,
        },
        expenseBreakdown,
        monthlyTrend,
        propertyPerformance,
        auditAlerts,
      },
    });
  } catch (error) {
    console.error('Error fetching financial overview:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getTransactions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const pool = getPool();
    const hostId = req.user?.id;

    if (!hostId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const period = (req.query.period as string) || 'all';
    const periodClause = getPeriodClause(period);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         b.id,
         b.created_at AS created_at,
         b.check_in_date,
         b.check_out_date,
         b.total_amount,
         b.status,
         b.payment_status,
         b.payment_reference,
         p.title AS property_title
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       WHERE b.host_id = ?
         ${periodClause}
       ORDER BY b.created_at DESC`,
      [hostId]
    );

    const transactions = rows.map(row => {
      const status = (row.payment_status || row.status || '').toLowerCase();
      let type: 'booking' | 'refund' | 'fee' | 'payout';
      if ((row.status || '').toLowerCase() === 'refunded' || status === 'refunded') {
        type = 'refund';
      } else if (status === 'failed') {
        type = 'fee';
      } else if (status === 'paid') {
        type = 'payout';
      } else {
        type = 'booking';
      }

      let normalizedStatus: 'completed' | 'pending' | 'failed' | 'refunded' = 'pending';
      switch (status) {
        case 'paid':
          normalizedStatus = 'completed';
          break;
        case 'refunded':
          normalizedStatus = 'refunded';
          break;
        case 'failed':
        case 'cancelled':
          normalizedStatus = 'failed';
          break;
        default:
          normalizedStatus = 'pending';
      }

      const description = `Booking #${row.id} · Check-out ${row.check_out_date ? new Date(row.check_out_date).toISOString().split('T')[0] : 'TBD'}`;

      return {
        id: row.id,
        date: row.created_at,
        type,
        property_title: row.property_title,
        amount: toNumber(row.total_amount),
        status: normalizedStatus,
        description,
      };
    });

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getMissingPaymentReferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const pool = getPool();
    const hostId = req.user?.id;

    if (!hostId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         b.id,
         b.total_amount,
         b.taxes,
         b.cleaning_fee,
         b.security_deposit,
         b.updated_at,
         b.created_at,
         b.check_in_date,
         b.check_out_date,
         b.guests_count,
         p.title AS property_title
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       WHERE b.host_id = ?
         AND b.payment_status = 'paid'
         AND (b.payment_reference IS NULL OR b.payment_reference = '')
       ORDER BY b.updated_at DESC`,
      [hostId]
    );

    const details = rows.map(row => {
      const checkInDate = row.check_in_date as string | null;
      const checkOutDate = row.check_out_date as string | null;
      let stayNights = 0;
      if (checkInDate && checkOutDate) {
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const diff = end.getTime() - start.getTime();
        stayNights = diff > 0 ? Math.round(diff / (1000 * 60 * 60 * 24)) : 0;
      }

      return {
        bookingId: row.id,
        propertyTitle: row.property_title,
        amount: toNumber(row.total_amount),
        taxes: toNumber(row.taxes),
        cleaningFee: toNumber(row.cleaning_fee),
        securityDeposit: toNumber(row.security_deposit),
        checkInDate,
        checkOutDate,
        paidAt: row.updated_at,
        createdAt: row.created_at,
  guestCount: Number(row.guests_count) || 0,
        stayNights,
      };
    });

    res.json({ success: true, data: details });
  } catch (error) {
    console.error('Error fetching missing payout references:', error);
    res.status(500).json({ success: false, message: 'Failed to load missing payout references' });
  }
};

export const exportMonthlyReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const pool = getPool();
    const hostId = req.user?.id;

    if (!hostId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const [trendRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         DATE_FORMAT(created_at, '%Y-%m') AS period,
         COALESCE(SUM(total_amount), 0) AS revenue,
         COALESCE(SUM(taxes), 0) AS taxes,
         COALESCE(SUM(cleaning_fee), 0) AS cleaningFees,
         COUNT(*) AS bookings
       FROM bookings
       WHERE host_id = ?
         AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
       GROUP BY period
       ORDER BY period`,
      [hostId]
    );

    const csv = buildCsv(
      ['Period', 'Gross Revenue ($)', 'Taxes ($)', 'Cleaning Fees ($)', 'Bookings'],
      trendRows.map((row) => [
        row.period,
        toNumber(row.revenue),
        toNumber(row.taxes),
        toNumber(row.cleaningFees),
        Number(row.bookings) || 0,
      ])
    );

    const filename = `financial-monthly-report-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting monthly financial report:', error);
    res.status(500).json({ success: false, message: 'Failed to export monthly report' });
  }
};

export const exportLedger = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const pool = getPool();
    const hostId = req.user?.id;

    if (!hostId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const period = (req.query.period as string) || 'all';
    const periodClause = getPeriodClause(period);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         b.id,
         b.created_at AS created_at,
         b.check_in_date,
         b.check_out_date,
         b.total_amount,
         b.status,
         b.payment_status,
         b.payment_reference,
         p.title AS property_title
       FROM bookings b
       JOIN properties p ON b.property_id = p.id
       WHERE b.host_id = ?
         ${periodClause}
       ORDER BY b.created_at DESC`,
      [hostId]
    );

    const ledgerRows = rows.map((row) => {
      const status = (row.payment_status || row.status || '').toLowerCase();
      let type: 'booking' | 'refund' | 'fee' | 'payout';
      if ((row.status || '').toLowerCase() === 'refunded' || status === 'refunded') {
        type = 'refund';
      } else if (status === 'failed') {
        type = 'fee';
      } else if (status === 'paid') {
        type = 'payout';
      } else {
        type = 'booking';
      }

      let normalizedStatus: 'completed' | 'pending' | 'failed' | 'refunded' = 'pending';
      switch (status) {
        case 'paid':
          normalizedStatus = 'completed';
          break;
        case 'refunded':
          normalizedStatus = 'refunded';
          break;
        case 'failed':
        case 'cancelled':
          normalizedStatus = 'failed';
          break;
        default:
          normalizedStatus = 'pending';
      }

      const description = `Booking #${row.id} · Check-out ${row.check_out_date ? new Date(row.check_out_date).toISOString().split('T')[0] : 'TBD'}`;

      return [
        row.id,
        new Date(row.created_at).toISOString(),
        type,
        row.property_title,
        toNumber(row.total_amount),
        normalizedStatus,
        description,
        row.payment_reference || '',
      ];
    });

    const csv = buildCsv(
      ['Transaction ID', 'Created At (UTC)', 'Type', 'Property', 'Amount ($)', 'Status', 'Description', 'Payment Reference'],
      ledgerRows
    );

    const filename = `financial-ledger-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting ledger transactions:', error);
    res.status(500).json({ success: false, message: 'Failed to export financial ledger' });
  }
};
