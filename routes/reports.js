const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Booking = require('../models/Booking');

const router = express.Router();

// Date-wise report
router.get('/date-wise', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ message: 'Date range is required' });
    }
    
    const bookings = await Booking.find({
      dateOfSubmission: {
        $gte: new Date(dateFrom),
        $lte: new Date(dateTo)
      }
    })
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ dateOfSubmission: -1 });
    
    const summary = {
      totalBookings: bookings.length,
      totalSalePrice: bookings.reduce((sum, b) => sum + b.totalSalePrice, 0),
      totalPaidAmount: bookings.reduce((sum, b) => sum + b.totalPaidAmount, 0),
      totalBalance: bookings.reduce((sum, b) => sum + b.balanceAmount, 0)
    };
    
    res.json({ bookings, summary });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Supplier-wise report
router.get('/supplier-wise', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { supplier, dateFrom, dateTo } = req.query;
    
    const query = {};
    if (supplier && supplier !== 'all') {
      query.supplier = supplier;
    }
    if (dateFrom || dateTo) {
      query.dateOfSubmission = {};
      if (dateFrom) query.dateOfSubmission.$gte = new Date(dateFrom);
      if (dateTo) query.dateOfSubmission.$lte = new Date(dateTo);
    }
    
    const bookings = await Booking.find(query)
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ dateOfSubmission: -1 });
    
    // Group by supplier
    const supplierGroups = {};
    bookings.forEach(booking => {
      const supplierName = booking.supplierName || 'No Supplier';
      if (!supplierGroups[supplierName]) {
        supplierGroups[supplierName] = {
          supplier: supplierName,
          bookings: [],
          totalSalePrice: 0,
          totalPaidAmount: 0,
          totalBalance: 0
        };
      }
      supplierGroups[supplierName].bookings.push(booking);
      supplierGroups[supplierName].totalSalePrice += booking.totalSalePrice;
      supplierGroups[supplierName].totalPaidAmount += booking.totalPaidAmount;
      supplierGroups[supplierName].totalBalance += booking.balanceAmount;
    });
    
    res.json({ groups: Object.values(supplierGroups) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Employee-wise report
router.get('/employee-wise', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const { employee, dateFrom, dateTo } = req.query;
    
    const query = {};
    if (employee && employee !== 'all') {
      query.submittedBy = employee;
    }
    if (dateFrom || dateTo) {
      query.dateOfSubmission = {};
      if (dateFrom) query.dateOfSubmission.$gte = new Date(dateFrom);
      if (dateTo) query.dateOfSubmission.$lte = new Date(dateTo);
    }
    
    const bookings = await Booking.find(query)
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ dateOfSubmission: -1 });
    
    // Group by employee
    const employeeGroups = {};
    bookings.forEach(booking => {
      const employeeName = booking.submittedByName || 'Unknown';
      if (!employeeGroups[employeeName]) {
        employeeGroups[employeeName] = {
          employee: employeeName,
          bookings: [],
          totalSalePrice: 0,
          totalPaidAmount: 0,
          totalBalance: 0
        };
      }
      employeeGroups[employeeName].bookings.push(booking);
      employeeGroups[employeeName].totalSalePrice += booking.totalSalePrice;
      employeeGroups[employeeName].totalPaidAmount += booking.totalPaidAmount;
      employeeGroups[employeeName].totalBalance += booking.balanceAmount;
    });
    
    res.json({ groups: Object.values(employeeGroups) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Pending Verification report
router.get('/pending-verification', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const bookings = await Booking.find({
      status: { $in: ['Pending Verification', 'Unticketed'] }
    })
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ dateOfSubmission: -1 });
    
    res.json({ bookings, count: bookings.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Outstanding Balance report
router.get('/outstanding-balance', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const bookings = await Booking.find({
      balanceAmount: { $gt: 0 },
      status: { $ne: 'Cancelled' }
    })
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .sort({ balanceAmount: -1 });
    
    const totalOutstanding = bookings.reduce((sum, b) => sum + b.balanceAmount, 0);
    
    res.json({ 
      bookings, 
      totalOutstanding,
      count: bookings.length 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
