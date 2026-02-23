const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paidAmount: {
    type: Number,
    required: true
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'Cheque', 'Credit Card', 'UPI', 'Bank Transfer'],
    required: true
  },
  paymentDate: {
    type: Date,
    required: true
  },
  referenceNo: {
    type: String,
    default: ''
  }
});

const progressHistorySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  performedByName: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  changes: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  remarks: {
    type: String,
    default: ''
  }
});

const bookingSchema = new mongoose.Schema({
  // Auto/System Fields
  dateOfSubmission: {
    type: Date,
    default: Date.now
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submittedByName: {
    type: String,
    required: true
  },
  
  // Passenger & Contact Details
  paxName: {
    type: String,
    required: true,
    uppercase: true
  },
  contactPerson: {
    type: String,
    default: ''
  },
  contactNumber: {
    type: String,
    required: true
  },
  pnr: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  // Travel Details
  sectorType: {
    type: String,
    enum: ['One Way', 'Round Trip', 'Multiple'],
    required: true
  },
  travelDate: {
    type: Date,
    required: true
  },
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  returnDate: {
    type: Date
  },
  multipleSectors: [{
    travelDate: Date,
    from: String,
    to: String
  }],
  note: {
    type: String,
    default: ''
  },
  
  // Commercial Details
  airline: {
    type: String,
    default: ''
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  supplierName: {
    type: String,
    default: ''
  },
  ourCost: {
    type: Number,
    default: 0
  },
  salePrice: {
    type: Number,
    default: 0
  },
  additionalService: {
    type: String,
    default: ''
  },
  additionalServicePrice: {
    type: Number,
    default: 0
  },
  additionalServices: [{
    serviceName: { type: String, default: '' },
    serviceCost: { type: Number, default: 0 }
  }],
  totalSalePrice: {
    type: Number,
    default: 0
  },
  
  // Payment Details
  paymentType: {
    type: String,
    enum: ['Full', 'Installments'],
    default: 'Full'
  },
  payments: [paymentSchema],
  totalPaidAmount: {
    type: Number,
    default: 0
  },
  balanceAmount: {
    type: Number,
    default: 0
  },
  billingStatus: {
    type: String,
    enum: ['Partial Paid', 'Fully Paid', 'Unpaid'],
    default: 'Unpaid'
  },
  
  // Status & Verification
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Pending Verification', 'Account Verified', 'Admin Verified', 'Billed', 'Paid', 'Unticketed', 'Ticked', 'Cancelled'],
    default: 'Draft'
  },
  verifiedByAccount: {
    type: Boolean,
    default: false
  },
  verifiedByAccountDate: {
    type: Date
  },
  verifiedByAccountUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedByAdmin: {
    type: Boolean,
    default: false
  },
  verifiedByAdminDate: {
    type: Date
  },
  verifiedByAdminUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Progress History
  progressHistory: [progressHistorySchema],
  
  // Post-Booking Changes
  dateChanges: [{
    oldTravelDate: Date,
    newTravelDate: Date,
    oldReturnDate: Date,
    newReturnDate: Date,
    oldOurCost: Number,
    newOurCost: Number,
    oldSalePrice: Number,
    newSalePrice: Number,
    remarks: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  flightChanges: [{
    oldDetails: mongoose.Schema.Types.Mixed,
    newDetails: mongoose.Schema.Types.Mixed,
    remarks: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  seatBookChanges: [{
    oldOurCost: Number,
    newOurCost: Number,
    oldSalePrice: Number,
    newSalePrice: Number,
    oldSupplier: mongoose.Schema.Types.ObjectId,
    newSupplier: mongoose.Schema.Types.ObjectId,
    paymentMode: String,
    remarks: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Cancellation
  cancellation: {
    isCancelled: {
      type: Boolean,
      default: false
    },
    paymentModeWas: {
      type: String,
      enum: ['Cash', 'Cheque', 'Credit Card']
    },
    totalAmountPaidByClient: {
      type: Number,
      default: 0
    },
    refundableAmount: {
      type: Number,
      default: 0
    },
    oldMargin: {
      type: Number,
      default: 0
    },
    committedToClient: {
      type: Number,
      default: 0
    },
    chargeFromClient: {
      type: Number,
      default: 0
    },
    newMargin: {
      type: Number,
      default: 0
    },
    supplierCancellationCharges: { type: Number, default: 0 },
    ourCancellationCharges: { type: Number, default: 0 },
    currentMargin: { type: Number, default: 0 },
    totalCancellationCharges: { type: Number, default: 0 },
    refundableAmountToClient: { type: Number, default: 0 },
    refundableAmountCommittedToClient: { type: Number, default: 0 },
    refundCommittedToClient: { type: Number, default: 0 },
    refundProcessed: {
      type: Boolean,
      default: false
    },
    refundProcessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    refundProcessedDate: {
      type: Date
    },
    remarks: {
      type: String,
      default: ''
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelledAt: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Indexes
bookingSchema.index({ pnr: 1 });
bookingSchema.index({ contactNumber: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ supplier: 1 });
bookingSchema.index({ submittedBy: 1 });
bookingSchema.index({ dateOfSubmission: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
