const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const Supplier = require('../models/Supplier');

const router = express.Router();

// Get all suppliers
router.get('/', auth, async (req, res) => {
  try {
    const suppliers = await Supplier.find({ isActive: true }).sort({ name: 1 });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create supplier (Admin only)
router.post('/', auth, authorize('ADMIN'), async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Supplier name is required' });
    }
    
    const existingSupplier = await Supplier.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existingSupplier) {
      return res.status(400).json({ message: 'Supplier already exists' });
    }
    
    const supplier = new Supplier({ name });
    await supplier.save();
    
    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update supplier (Admin only)
router.put('/:id', auth, authorize('ADMIN'), async (req, res) => {
  try {
    const { name, isActive } = req.body;
    
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    if (name) {
      const existingSupplier = await Supplier.findOne({ 
        _id: { $ne: req.params.id },
        name: { $regex: new RegExp(`^${name}$`, 'i') } 
      });
      
      if (existingSupplier) {
        return res.status(400).json({ message: 'Supplier name already exists' });
      }
      
      supplier.name = name;
    }
    
    if (isActive !== undefined) supplier.isActive = isActive;
    
    await supplier.save();
    
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete supplier (Admin only)
router.delete('/:id', auth, authorize('ADMIN'), async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    await Supplier.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
