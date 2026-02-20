const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Booking = require('../models/Booking');
const Supplier = require('../models/Supplier');
const User = require('../models/User');

const router = express.Router();

// Helper function to add progress history
const addProgressHistory = (booking, action, user, changes = {}, remarks = '') => {
  booking.progressHistory.unshift({
    action,
    performedBy: user._id,
    performedByName: user.name,
    timestamp: new Date(),
    changes,
    remarks
  });
};

// Helper function to calculate totals
const calculateTotals = (booking) => {
  booking.totalSalePrice = booking.salePrice + (booking.additionalServicePrice || 0);
  booking.totalPaidAmount = booking.payments.reduce((sum, p) => sum + p.paidAmount, 0);
  booking.balanceAmount = booking.totalSalePrice - booking.totalPaidAmount;
  
  if (booking.balanceAmount <= 0) {
    booking.billingStatus = 'Fully Paid';
  } else if (booking.totalPaidAmount > 0) {
    booking.billingStatus = 'Partial Paid';
  } else {
    booking.billingStatus = 'Unpaid';
  }
};

// Create booking (Agent1 and Admin only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'AGENT2') {
      return res.status(403).json({ message: 'Agent2 cannot create bookings' });
    }
    
    const {
      paxName,
      contactPerson,
      contactNumber,
      pnr,
      sectorType,
      travelDate,
      from,
      to,
      returnDate,
      multipleSectors,
      note,
      airline,
      supplier,
      ourCost,
      salePrice,
      additionalService,
      additionalServicePrice,
      paymentType,
      payments
    } = req.body;
    
    // Validation
    if (!paxName || !contactNumber || !pnr || !sectorType || !travelDate || !from || !to) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Check if PNR already exists
    const existingBooking = await Booking.findOne({ pnr: pnr.toUpperCase() });
    if (existingBooking) {
      return res.status(400).json({ message: 'PNR already exists' });
    }
    
    // Get supplier name if supplier ID provided
    let supplierName = '';
    if (supplier) {
      const supplierDoc = await Supplier.findById(supplier);
      if (supplierDoc) {
        supplierName = supplierDoc.name;
        // Check if supplier is "Agent2" (Unticketed status)
        if (supplierDoc.name === 'Agent2') {
          // Status will be set to Unticketed
        }
      }
    }
    
    const isAgent2Supplier = supplierName === 'Agent2';
    const booking = new Booking({
      paxName: paxName.toUpperCase(),
      contactPerson: contactPerson || '',
      contactNumber,
      pnr: pnr.toUpperCase(),
      sectorType,
      travelDate: new Date(travelDate),
      from: from.charAt(0).toUpperCase() + from.slice(1),
      to: to.charAt(0).toUpperCase() + to.slice(1),
      returnDate: returnDate ? new Date(returnDate) : null,
      multipleSectors: sectorType === 'Multiple' ? multipleSectors : [],
      note: note || '',
      airline: airline || '',
      supplier: supplier || null,
      supplierName,
      ourCost: ourCost || 0,
      salePrice: salePrice || 0,
      additionalService: additionalService || '',
      additionalServicePrice: additionalServicePrice ?? 0,
      paymentType: paymentType || 'Full',
      payments: payments || [],
      submittedBy: req.user._id,
      submittedByName: req.user.name,
      status: isAgent2Supplier ? 'Unticketed' : 'Draft',
      dateOfSubmission: isAgent2Supplier ? new Date() : undefined
    });
    
    calculateTotals(booking);
    
    addProgressHistory(booking, 'Booking Created', req.user, {
      pnr: booking.pnr,
      paxName: booking.paxName
    });
    
    await booking.save();
    
    const populatedBooking = await Booking.findById(booking._id)
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .populate('assignedTo', 'name email');
    
    res.status(201).json(populatedBooking);
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all bookings with filters
router.get('/', auth, async (req, res) => {
  try {
    const {
      status,
      supplier,
      dateFrom,
      dateTo,
      pnr,
      contactNumber,
      page = 1,
      limit = 50
    } = req.query;
    
    const query = {};
    
    // Role-based visibility: Agent only their bookings, Account only non-Draft, Admin all
    if (req.user.role === 'AGENT1' || req.user.role === 'AGENT2') {
      query.submittedBy = req.user._id;
    } else if (req.user.role === 'ACCOUNT') {
      query.status = { $ne: 'Draft' };
    }
    
    // Display status filter: Ticked | Unticketed | Cancelled
    if (status && status !== 'all') {
      if (status === 'Cancelled') {
        query.status = 'Cancelled';
      } else if (status === 'Unticketed') {
        query.supplierName = 'Agent2';
        query.status = req.user.role === 'ACCOUNT' ? { $nin: ['Cancelled', 'Draft'] } : { $ne: 'Cancelled' };
      } else if (status === 'Ticked') {
        query.status = req.user.role === 'ACCOUNT' ? { $nin: ['Cancelled', 'Draft'] } : { $ne: 'Cancelled' };
        query.$and = query.$and || [];
        query.$and.push({ $or: [{ supplierName: { $ne: 'Agent2' } }, { supplierName: { $exists: false } }, { supplierName: '' }, { supplierName: null }] });
      } else {
        query.status = status;
      }
    }
    
    if (supplier && supplier !== 'all') {
      query.supplier = supplier;
    }
    
    if (pnr) {
      query.pnr = { $regex: pnr.toUpperCase(), $options: 'i' };
    }
    
    if (contactNumber) {
      query.contactNumber = { $regex: contactNumber, $options: 'i' };
    }
    
    if (dateFrom || dateTo) {
      query.dateOfSubmission = {};
      if (dateFrom) query.dateOfSubmission.$gte = new Date(dateFrom);
      if (dateTo) query.dateOfSubmission.$lte = new Date(dateTo);
    }
    
    const bookings = await Booking.find(query)
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .populate('assignedTo', 'name email')
      .sort({ dateOfSubmission: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Booking.countDocuments(query);
    
    res.json({
      bookings,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get booking by ID (role-based: Agent only own, Account no Draft, Admin all)
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .populate('assignedTo', 'name email')
      .populate('verifiedByAccountUser', 'name email')
      .populate('verifiedByAdminUser', 'name email');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    if (req.user.role === 'AGENT1' || req.user.role === 'AGENT2') {
      const submittedById = booking.submittedBy && (booking.submittedBy._id || booking.submittedBy);
      if (submittedById && submittedById.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'You can only view your own bookings' });
      }
    } else if (req.user.role === 'ACCOUNT') {
      if (booking.status === 'Draft') {
        return res.status(403).json({ message: 'You cannot view draft bookings' });
      }
    }
    
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Search booking by PNR or Contact Number (role-based same as list)
router.get('/search/:query', auth, async (req, res) => {
  try {
    const searchTerm = req.params.query;
    const findQuery = {
      $or: [
        { pnr: { $regex: searchTerm.toUpperCase(), $options: 'i' } },
        { contactNumber: { $regex: searchTerm, $options: 'i' } }
      ]
    };
    if (req.user.role === 'AGENT1' || req.user.role === 'AGENT2') {
      findQuery.submittedBy = req.user._id;
    } else if (req.user.role === 'ACCOUNT') {
      findQuery.status = { $ne: 'Draft' };
    }
    
    const bookings = await Booking.find(findQuery)
      .populate('submittedBy', 'name email')
      .populate('supplier', 'name')
      .populate('assignedTo', 'name email')
      .sort({ dateOfSubmission: -1 })
      .limit(20);
    
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update booking
router.put('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    const userRole = req.user.role;
    const isSubmitted = booking.status !== 'Draft';
    const isVerified = booking.verifiedByAccount || booking.verifiedByAdmin;
    
    // Role-based edit permissions
    if (userRole === 'AGENT2') {
      if (isSubmitted) {
        // Agent2 can only edit commercial fields after submission
        const { supplier, ourCost, salePrice, additionalService, additionalServicePrice } = req.body;
        
        if (supplier !== undefined) {
          const supplierDoc = await Supplier.findById(supplier);
          if (supplierDoc) {
            const oldSupplierName = booking.supplierName;
            booking.supplier = supplier;
            booking.supplierName = supplierDoc.name;
            if (supplierDoc.name === 'Agent2') {
              booking.status = 'Unticketed';
            } else if (oldSupplierName === 'Agent2' && supplierDoc.name !== 'Agent2') {
              booking.status = 'Ticked';
            }
          }
        }
        if (ourCost !== undefined) booking.ourCost = ourCost;
        if (salePrice !== undefined) booking.salePrice = salePrice;
        if (additionalService !== undefined) booking.additionalService = additionalService;
        if (additionalServicePrice !== undefined) booking.additionalServicePrice = additionalServicePrice;
        
        calculateTotals(booking);
        
        addProgressHistory(booking, 'Commercial Details Updated', req.user, {
          supplier: booking.supplierName,
          ourCost: booking.ourCost,
          salePrice: booking.salePrice
        });
        
        await booking.save();
        return res.json(await Booking.findById(booking._id).populate('supplier', 'name'));
      } else {
        return res.status(403).json({ message: 'Agent2 cannot edit bookings before submission' });
      }
    }
    
    if (userRole === 'AGENT1') {
      if (isVerified) {
        return res.status(403).json({ message: 'Cannot edit verified bookings' });
      }
      
      // Agent1 can edit all fields before verification
      const updates = req.body;
      const changes = {};
      
      if (updates.supplier !== undefined) {
        const supplierDoc = await Supplier.findById(updates.supplier);
        if (supplierDoc) {
          const oldSupplierName = booking.supplierName;
          booking.supplier = updates.supplier;
          booking.supplierName = supplierDoc.name;
          if (supplierDoc.name === 'Agent2') {
            booking.status = 'Unticketed';
          } else if (oldSupplierName === 'Agent2' && supplierDoc.name !== 'Agent2') {
            booking.status = 'Ticked';
          }
          changes.supplier = supplierDoc.name;
        }
      }
      
      Object.keys(updates).forEach(key => {
        if (['paxName', 'contactPerson', 'contactNumber', 'sectorType', 'travelDate', 
             'from', 'to', 'returnDate', 'multipleSectors', 'note', 'airline', 
             'ourCost', 'salePrice', 'additionalService', 'additionalServicePrice'].includes(key)) {
          if (key === 'paxName') {
            booking[key] = updates[key].toUpperCase();
          } else if (key === 'from' || key === 'to') {
            booking[key] = updates[key].charAt(0).toUpperCase() + updates[key].slice(1);
          } else if (key === 'travelDate' || key === 'returnDate') {
            booking[key] = new Date(updates[key]);
          } else {
            booking[key] = updates[key];
          }
          changes[key] = updates[key];
        }
      });
      
      calculateTotals(booking);
      
      if (Object.keys(changes).length > 0) {
        addProgressHistory(booking, 'Booking Updated', req.user, changes);
      }
      
      await booking.save();
      return res.json(await Booking.findById(booking._id).populate('supplier', 'name'));
    }
    
    if (userRole === 'ACCOUNT') {
      // Account can only edit payment-related fields
      const { payments, billingStatus } = req.body;
      
      if (payments !== undefined) {
        booking.payments = payments;
        calculateTotals(booking);
        addProgressHistory(booking, 'Payments Updated', req.user, { payments });
      }
      
      if (billingStatus !== undefined) {
        booking.billingStatus = billingStatus;
        addProgressHistory(booking, 'Billing Status Updated', req.user, { billingStatus });
      }
      
      await booking.save();
      return res.json(await Booking.findById(booking._id).populate('supplier', 'name'));
    }
    
    if (userRole === 'ADMIN') {
      // Admin can edit everything (including status and cancellation revert)
      const updates = req.body;
      const changes = {};
      
      for (const key of Object.keys(updates)) {
        if (key !== '_id' && key !== '__v' && key !== 'progressHistory') {
          if (key === 'supplier' && updates[key]) {
            const supplierDoc = await Supplier.findById(updates[key]);
            if (supplierDoc) {
              const oldSupplierName = booking.supplierName;
              booking.supplier = updates[key];
              booking.supplierName = supplierDoc.name;
              if (supplierDoc.name === 'Agent2') {
                booking.status = 'Unticketed';
              } else if (oldSupplierName === 'Agent2' && supplierDoc.name !== 'Agent2') {
                booking.status = 'Ticked';
              }
              changes[key] = supplierDoc.name;
            }
          } else if (key === 'cancellation') {
            // Admin can revert cancellation (e.g. set isCancelled: false)
            const val = updates[key];
            if (val && typeof val === 'object' && val.isCancelled === false) {
              booking.cancellation = { isCancelled: false };
              changes[key] = 'reverted (active)';
            } else {
              booking[key] = val;
              changes[key] = val;
            }
          } else if (key === 'travelDate' || key === 'returnDate') {
            booking[key] = new Date(updates[key]);
            changes[key] = updates[key];
          } else if (key === 'paxName') {
            booking[key] = updates[key].toUpperCase();
            changes[key] = updates[key];
          } else if (key === 'from' || key === 'to') {
            booking[key] = updates[key].charAt(0).toUpperCase() + updates[key].slice(1);
            changes[key] = updates[key];
          } else {
            booking[key] = updates[key];
            changes[key] = updates[key];
          }
        }
      }
      
      calculateTotals(booking);
      
      if (Object.keys(changes).length > 0) {
        addProgressHistory(booking, 'Booking Updated by Admin', req.user, changes);
      }
      
      await booking.save();
      return res.json(await Booking.findById(booking._id).populate('supplier', 'name'));
    }
    
    res.status(403).json({ message: 'Unauthorized' });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Submit booking (Agent1)
router.post('/:id/submit', auth, authorize('AGENT1', 'ADMIN'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    if (booking.status !== 'Draft') {
      return res.status(400).json({ message: 'Booking already submitted' });
    }
    booking.status = booking.supplierName === 'Agent2' ? 'Unticketed' : 'Pending Verification';
    if (!booking.dateOfSubmission) {
      booking.dateOfSubmission = new Date();
    }
    
    addProgressHistory(booking, 'Booking Submitted', req.user);
    
    await booking.save();
    
    res.json(await Booking.findById(booking._id).populate('supplier', 'name'));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify booking (Account)
router.post('/:id/verify-account', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    booking.verifiedByAccount = true;
    booking.verifiedByAccountDate = new Date();
    booking.verifiedByAccountUser = req.user._id;
    
    if (booking.status === 'Pending Verification' || booking.status === 'Unticketed') {
      booking.status = 'Account Verified';
    }
    
    addProgressHistory(booking, 'Verified by Account', req.user);
    
    await booking.save();
    
    res.json(await Booking.findById(booking._id).populate('supplier', 'name'));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify booking (Admin)
router.post('/:id/verify-admin', auth, authorize('ADMIN'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    booking.verifiedByAdmin = true;
    booking.verifiedByAdminDate = new Date();
    booking.verifiedByAdminUser = req.user._id;
    
    if (booking.status !== 'Billed' && booking.status !== 'Paid') {
      booking.status = 'Admin Verified';
    }
    
    addProgressHistory(booking, 'Verified by Admin', req.user);
    
    await booking.save();
    
    res.json(await Booking.findById(booking._id).populate('supplier', 'name'));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Date Change
router.post('/:id/date-change', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    const { 
      changeTravelDate, 
      changeReturnDate, 
      newTravelDate, 
      newReturnDate, 
      newOurCost, 
      newSalePrice, 
      remarks 
    } = req.body;
    
    if (!remarks) {
      return res.status(400).json({ message: 'Remarks are mandatory' });
    }
    
    // Check if dates are in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const oldTravelDate = new Date(booking.travelDate);
    oldTravelDate.setHours(0, 0, 0, 0);
    
    const oldReturnDate = booking.returnDate ? new Date(booking.returnDate) : null;
    if (oldReturnDate) {
      oldReturnDate.setHours(0, 0, 0, 0);
    }
    
    if (oldTravelDate < today) {
      if (!changeTravelDate && !changeReturnDate) {
        return res.status(400).json({ message: 'Please select which date(s) to change' });
      }
    }
    
    const dateChange = {
      oldTravelDate: booking.travelDate,
      newTravelDate: changeTravelDate && newTravelDate ? new Date(newTravelDate) : booking.travelDate,
      oldReturnDate: booking.returnDate,
      newReturnDate: changeReturnDate && newReturnDate ? new Date(newReturnDate) : booking.returnDate,
      oldOurCost: booking.ourCost,
      newOurCost: newOurCost !== undefined ? newOurCost : booking.ourCost,
      oldSalePrice: booking.salePrice,
      newSalePrice: newSalePrice !== undefined ? newSalePrice : booking.salePrice,
      remarks,
      changedBy: req.user._id,
      changedAt: new Date()
    };
    
    // Update booking
    if (changeTravelDate && newTravelDate) {
      booking.travelDate = new Date(newTravelDate);
    }
    if (changeReturnDate && newReturnDate) {
      booking.returnDate = new Date(newReturnDate);
    }
    if (newOurCost !== undefined) {
      booking.ourCost = newOurCost;
    }
    if (newSalePrice !== undefined) {
      booking.salePrice = newSalePrice;
    }
    
    calculateTotals(booking);
    booking.dateChanges.push(dateChange);
    
    addProgressHistory(booking, 'Date Change', req.user, dateChange, remarks);
    
    await booking.save();
    
    res.json(await Booking.findById(booking._id).populate('supplier', 'name'));
  } catch (error) {
    console.error('Date change error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Flight Change
router.post('/:id/flight-change', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    const { newDetails, remarks } = req.body;
    
    if (!remarks) {
      return res.status(400).json({ message: 'Remarks are mandatory' });
    }
    
    const oldDetails = {
      airline: booking.airline,
      from: booking.from,
      to: booking.to,
      travelDate: booking.travelDate,
      returnDate: booking.returnDate
    };
    
    const flightChange = {
      oldDetails,
      newDetails: newDetails || {},
      remarks,
      changedBy: req.user._id,
      changedAt: new Date()
    };
    
    // Update booking if new details provided
    if (newDetails) {
      if (newDetails.airline !== undefined) booking.airline = newDetails.airline;
      if (newDetails.from !== undefined) booking.from = newDetails.from.charAt(0).toUpperCase() + newDetails.from.slice(1);
      if (newDetails.to !== undefined) booking.to = newDetails.to.charAt(0).toUpperCase() + newDetails.to.slice(1);
      if (newDetails.travelDate !== undefined) booking.travelDate = new Date(newDetails.travelDate);
      if (newDetails.returnDate !== undefined) booking.returnDate = new Date(newDetails.returnDate);
    }
    
    booking.flightChanges.push(flightChange);
    
    addProgressHistory(booking, 'Flight Change', req.user, flightChange, remarks);
    
    await booking.save();
    
    res.json(await Booking.findById(booking._id).populate('supplier', 'name'));
  } catch (error) {
    console.error('Flight change error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Seat Book
router.post('/:id/seat-book', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    const { newOurCost, newSalePrice, newSupplier, paymentMode, remarks } = req.body;
    
    if (!remarks) {
      return res.status(400).json({ message: 'Remarks are mandatory' });
    }
    
    const seatBookChange = {
      oldOurCost: booking.ourCost,
      newOurCost: newOurCost !== undefined ? newOurCost : booking.ourCost,
      oldSalePrice: booking.salePrice,
      newSalePrice: newSalePrice !== undefined ? newSalePrice : booking.salePrice,
      oldSupplier: booking.supplier,
      newSupplier: newSupplier || booking.supplier,
      paymentMode: paymentMode || '',
      remarks,
      changedBy: req.user._id,
      changedAt: new Date()
    };
    
    // Update booking
    if (newOurCost !== undefined) booking.ourCost = newOurCost;
    if (newSalePrice !== undefined) booking.salePrice = newSalePrice;
    if (newSupplier) {
      const supplierDoc = await Supplier.findById(newSupplier);
      if (supplierDoc) {
        const oldSupplierName = booking.supplierName;
        booking.supplier = newSupplier;
        booking.supplierName = supplierDoc.name;
        if (supplierDoc.name === 'Agent2') {
          booking.status = 'Unticketed';
        } else if (oldSupplierName === 'Agent2' && supplierDoc.name !== 'Agent2') {
          booking.status = 'Ticked';
        }
      }
    }
    
    calculateTotals(booking);
    booking.seatBookChanges.push(seatBookChange);
    
    addProgressHistory(booking, 'Seat Book', req.user, seatBookChange, remarks);
    
    await booking.save();
    
    res.json(await Booking.findById(booking._id).populate('supplier', 'name'));
  } catch (error) {
    console.error('Seat book error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Cancel booking (Account or Admin only)
router.post('/:id/cancel', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    const {
      paymentModeWas,
      refundableAmount,
      committedToClient,
      chargeFromClient,
      remarks
    } = req.body;
    
    if (!paymentModeWas || !remarks) {
      return res.status(400).json({ message: 'Payment mode and remarks are required' });
    }
    
    const totalAmountPaid = booking.totalPaidAmount;
    const oldMargin = booking.salePrice - booking.ourCost;
    
    let newMargin = 0;
    if (paymentModeWas === 'Credit Card') {
      if (chargeFromClient === undefined) {
        return res.status(400).json({ message: 'Charge from client is required for credit card payments' });
      }
      newMargin = booking.salePrice - chargeFromClient;
    } else {
      if (committedToClient === undefined) {
        return res.status(400).json({ message: 'Committed to client is required' });
      }
      newMargin = booking.salePrice - committedToClient;
    }
    
    booking.cancellation = {
      isCancelled: true,
      paymentModeWas,
      totalAmountPaidByClient: totalAmountPaid,
      refundableAmount: refundableAmount || 0,
      oldMargin,
      committedToClient: committedToClient || 0,
      chargeFromClient: chargeFromClient || 0,
      newMargin,
      refundProcessed: false,
      remarks,
      cancelledBy: req.user._id,
      cancelledAt: new Date()
    };
    
    booking.status = 'Cancelled';
    
    addProgressHistory(booking, 'Booking Cancelled', req.user, {
      paymentModeWas,
      refundableAmount,
      oldMargin,
      newMargin
    }, remarks);
    
    await booking.save();
    
    res.json(await Booking.findById(booking._id).populate('supplier', 'name'));
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Process refund
router.post('/:id/process-refund', auth, authorize('ACCOUNT', 'ADMIN'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    if (!booking.cancellation || !booking.cancellation.isCancelled) {
      return res.status(400).json({ message: 'Booking is not cancelled' });
    }
    
    booking.cancellation.refundProcessed = true;
    booking.cancellation.refundProcessedBy = req.user._id;
    booking.cancellation.refundProcessedDate = new Date();
    
    addProgressHistory(booking, 'Refund Processed', req.user, {
      refundProcessedBy: req.user.name,
      refundProcessedDate: new Date()
    });
    
    await booking.save();
    
    res.json(await Booking.findById(booking._id).populate('supplier', 'name'));
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
