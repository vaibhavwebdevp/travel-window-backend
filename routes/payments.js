const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Booking = require('../models/Booking');

const router = express.Router();

/**
 * GET /api/payments - List all payments (flattened from bookings). Admin only.
 * Query: pnr, paymentMode, startDate, endDate
 */
router.get('/', auth, authorize('ADMIN'), async (req, res) => {
  try {
    const { pnr, paymentMode, startDate, endDate } = req.query;

    const filter = {};
    if (pnr && pnr.trim()) {
      filter.pnr = new RegExp(pnr.trim(), 'i');
    }
    if (startDate || endDate) {
      filter['payments.paymentDate'] = {};
      if (startDate) filter['payments.paymentDate'].$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter['payments.paymentDate'].$lte = end;
      }
    }
    if (paymentMode && paymentMode !== 'All Modes' && paymentMode.trim()) {
      filter['payments.paymentMode'] = paymentMode.trim();
    }

    const bookings = await Booking.find(filter)
      .select('pnr paxName submittedByName payments')
      .lean();

    const rows = [];
    for (const b of bookings) {
      if (!b.payments || !b.payments.length) continue;
      const addedBy = b.submittedByName || '—';
      for (const p of b.payments) {
        if (paymentMode && paymentMode !== 'All Modes' && paymentMode.trim() && p.paymentMode !== paymentMode.trim()) continue;
        if (startDate && new Date(p.paymentDate) < new Date(startDate)) continue;
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (new Date(p.paymentDate) > end) continue;
        }
        rows.push({
          date: p.paymentDate,
          bookingPnr: b.pnr,
          passenger: b.paxName,
          amount: p.paidAmount,
          mode: p.paymentMode,
          reference: p.referenceNo || '—',
          addedBy,
          bookingId: b._id.toString(),
        });
      }
    }

    // Sort by date descending
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalPayments = rows.length;
    const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);
    const averagePayment = totalPayments > 0 ? totalAmount / totalPayments : 0;

    return res.json({
      payments: rows,
      summary: {
        totalPayments,
        totalAmount,
        averagePayment: Math.round(averagePayment * 1000) / 1000,
      },
    });
  } catch (err) {
    console.error('Payments list error:', err);
    return res.status(500).json({ message: 'Failed to fetch payments' });
  }
});

module.exports = router;
