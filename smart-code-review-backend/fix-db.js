const mongoose = require('mongoose');

async function fixDB() {
  try {
    await mongoose.connect('mongodb://localhost:27017/smartcodereview');
    console.log('Connected to DB');
    await mongoose.connection.collection('users').drop();
    console.log('Legacy users collection dropped successfully!');
  } catch (err) {
    if (err.message === 'ns not found') {
      console.log('Users collection already dropped.');
    } else {
      console.error('Error:', err);
    }
  } finally {
    process.exit(0);
  }
}

fixDB();
