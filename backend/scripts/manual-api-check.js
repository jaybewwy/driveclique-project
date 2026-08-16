/**
 * Manual API smoke-check script — not a unit test, do not run via `npm test`.
 * Requires the backend dev server running on :5000.
 * Run with: node scripts/manual-api-check.js
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testAPI() {
  console.log('🧪 Testing DriveClique API Endpoints\n');
  
  // Test 1: Health check
  try {
    console.log('1. Testing health check...');
    const response = await axios.get(`${API_BASE}/`);
    console.log('   ✅ Health check passed:', response.data.message);
  } catch (error) {
    console.log('   ❌ Health check failed:', error.message);
    return;
  }

  // Test 2: Try to access protected routes without token
  console.log('\n2. Testing authentication requirement...');
  try {
    await axios.get(`${API_BASE}/clubs`);
    console.log('   ❌ Should have required authentication');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('   ✅ Protected routes correctly require authentication');
    } else {
      console.log('   ❌ Unexpected error:', error.message);
    }
  }

  console.log('\n✅ API basic tests completed!');
  console.log('\n📝 Next steps:');
  console.log('   1. Make sure MongoDB is running');
  console.log('   2. Start the backend: npm run dev');
  console.log('   3. Start the frontend: npm run dev');
  console.log('   4. Check browser console for any errors');
}

testAPI().catch(console.error);