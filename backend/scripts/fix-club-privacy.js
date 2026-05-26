/**
 * Script to check and fix club privacy settings
 * Run with: node scripts/fix-club-privacy.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const Club = require('../models/club');

async function fixClubPrivacy() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/driveclique');
    console.log('Connected to MongoDB');

    // Get all clubs
    const allClubs = await Club.find({});
    console.log(`\nTotal clubs in database: ${allClubs.length}`);
    
    const publicClubs = allClubs.filter(c => c.isPrivate === false);
    const privateClubs = allClubs.filter(c => c.isPrivate === true);
    const undefinedClubs = allClubs.filter(c => c.isPrivate === undefined || c.isPrivate === null);
    
    console.log(`\nClub Privacy Status:`);
    console.log(`  Public (isPrivate: false): ${publicClubs.length}`);
    console.log(`  Private (isPrivate: true): ${privateClubs.length}`);
    console.log(`  Undefined (isPrivate: undefined/null): ${undefinedClubs.length}`);
    
    if (undefinedClubs.length > 0) {
      console.log('\nClubs with undefined isPrivate:');
      undefinedClubs.forEach(c => console.log(`  - ${c.name} (${c._id})`));
      
      // Fix: Set isPrivate to false for clubs with undefined value
      const fixResult = await Club.updateMany(
        { isPrivate: { $in: [undefined, null] } },
        { $set: { isPrivate: false } }
      );
      console.log(`\nFixed ${fixResult.modifiedCount} clubs - set isPrivate to false`);
    }
    
    console.log('\nAll clubs:');
    allClubs.forEach(c => {
      console.log(`  - ${c.name}: isPrivate=${c.isPrivate}`);
    });
    
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixClubPrivacy();