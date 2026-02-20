const mongoose = require('mongoose');
const { runSeed } = require('./seedLogic');
require('dotenv').config();

const uri =
  process.env.travel_window_MONGODB_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/travel_agency';

async function main() {
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
    const created = await runSeed(mongoose.connection);
    console.log('Seed done. Created users:', created.users, 'suppliers:', created.suppliers);
    process.exit(0);
  } catch (error) {
    const isConnectionError =
      error.name === 'MongooseServerSelectionError' ||
      (error.message && error.message.includes('ECONNREFUSED'));
    if (isConnectionError) {
      console.error('\n❌ Cannot connect to MongoDB. Set MONGODB_URI or travel_window_MONGODB_URI in .env\n');
    } else {
      console.error('Seed error:', error);
    }
    process.exit(1);
  }
}

main();
