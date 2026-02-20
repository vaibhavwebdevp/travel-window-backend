/**
 * Shared seed logic – used by CLI (scripts/seed.js) and API route (routes/seed.js).
 * Idempotent: safe to run multiple times (skips existing users/suppliers).
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const Supplier = require('../models/Supplier');

const users = [
  { email: 'admin@travel.com', password: 'admin123', role: 'ADMIN', name: 'Admin User' },
  { email: 'account@travel.com', password: 'account123', role: 'ACCOUNT', name: 'Account User' },
  { email: 'agent1@travel.com', password: 'agent1123', role: 'AGENT1', name: 'Agent 1' },
  { email: 'agent2@travel.com', password: 'agent2123', role: 'AGENT2', name: 'Agent 2' },
];

const suppliers = [
  { name: 'Agent2' },
  { name: 'Air India' },
  { name: 'IndiGo' },
  { name: 'SpiceJet' },
  { name: 'Vistara' },
];

async function runSeed() {
  const created = { users: 0, suppliers: 0 };
  const UserModel = User;
  const SupplierModel = Supplier;

  for (const userData of users) {
    const existing = await UserModel.findOne({ email: userData.email });
    if (!existing) {
      const user = new UserModel(userData);
      await user.save();
      created.users++;
    }
  }

  for (const s of suppliers) {
    const existing = await SupplierModel.findOne({
      name: { $regex: new RegExp(`^${s.name}$`, 'i') },
    });
    if (!existing) {
      await SupplierModel.create(s);
      created.suppliers++;
    }
  }

  return created;
}

module.exports = { runSeed, users, suppliers };
