import express from 'express';
import { getFinancials, getTransactions, exportMonthlyReport, exportLedger, getMissingPaymentReferences } from '../controllers/financialsController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, getFinancials);
router.get('/transactions', authenticateToken, getTransactions);
router.get('/export/monthly-report', authenticateToken, exportMonthlyReport);
router.get('/export/ledger', authenticateToken, exportLedger);
router.get('/audit/missing-payout-references', authenticateToken, getMissingPaymentReferences);

export default router;
