const express = require('express');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const Booking = require('../models/Booking');
const User = require('../models/User');

const router = express.Router();

// Dashboard stats – role-based (Agent1: own + assigned to me)
router.get('/stats', auth, async (req, res) => {
  try {
    const baseQuery = {};
    if (req.user.role === 'AGENT1') {
      baseQuery.$or = [
        { submittedBy: req.user._id },
        { assignedTo: req.user._id }
      ];
    } else if (req.user.role === 'AGENT2') {
      // Agent2 sees all bookings (same as list API) so counts match Unticketed list
      // no baseQuery filter
    } else if (req.user.role === 'ACCOUNT') {
      baseQuery.status = { $ne: 'Draft' };
    }

    // Unticketed list shows supplierName Agent2 + status != Cancelled (same as list API filter)
    const unticketedQuery = { ...baseQuery, supplierName: 'Agent2', status: { $ne: 'Cancelled' } };
    const assignedToMeQuery = { assignedTo: req.user._id };
    const showAssignedCount = ['AGENT1', 'AGENT2', 'ACCOUNT'].includes(req.user.role);
    const [
      totalBookings,
      draftCount,
      pendingVerificationCount,
      unticketedCount,
      cancelledCount,
      totalUsers,
      assignedTicketsCount
    ] = await Promise.all([
      Booking.countDocuments(baseQuery),
      Booking.countDocuments({ ...baseQuery, status: 'Draft' }),
      Booking.countDocuments({ ...baseQuery, status: 'Pending Verification' }),
      Booking.countDocuments(unticketedQuery),
      Booking.countDocuments({ ...baseQuery, status: 'Cancelled' }),
      req.user.role === 'ADMIN' ? User.countDocuments({ isActive: true }) : Promise.resolve(null),
      showAssignedCount ? Booking.countDocuments(assignedToMeQuery) : Promise.resolve(null)
    ]);

    const stats = {
      totalBookings,
      draftCount,
      pendingVerificationCount,
      unticketedCount,
      cancelledCount,
      totalUsers: totalUsers ?? undefined,
      assignedTicketsCount: assignedTicketsCount ?? undefined
    };
    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Recent activity – from progressHistory (role-based: Account sees only their actions, Agents see their bookings’ activity, Admin sees all)
router.get('/activity', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const matchStage = {};
    if (req.user.role === 'AGENT1') {
      matchStage.$or = [
        { submittedBy: userId },
        { assignedTo: userId }
      ];
    } else if (req.user.role === 'AGENT2') {
      matchStage.submittedBy = req.user._id;
    } else if (req.user.role === 'ACCOUNT') {
      // Account sees only bookings they have access to (non-Draft), then filter to only their own actions
      matchStage.status = { $ne: 'Draft' };
    }

    const pipeline = [
      { $match: matchStage },
      { $addFields: { _assignedToMe: { $eq: ['$assignedTo', userId] } } },
      { $unwind: '$progressHistory' }
    ];

    if (req.user.role === 'ACCOUNT') {
      pipeline.push({
        $match: { 'progressHistory.performedBy': userId }
      });
    }

    pipeline.push(
      { $sort: { _assignedToMe: -1, 'progressHistory.timestamp': -1 } },
      { $limit: limit },
      {
        $project: {
          action: '$progressHistory.action',
          performedByName: '$progressHistory.performedByName',
          timestamp: '$progressHistory.timestamp',
          remarks: '$progressHistory.remarks',
          pnr: '$pnr',
          bookingId: '$_id'
        }
      }
    );

    const activities = await Booking.aggregate(pipeline);
    res.json(activities);
  } catch (error) {
    console.error('Dashboard activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
