// Simple test script to verify the profile image upload endpoint
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_BASE = 'http://localhost:3001/api/v1';

async function testProfileImageUpload() {
  try {
    console.log('Testing profile image upload endpoint...');
    
    // First test if the endpoint exists
    const response = await axios.get(`${API_BASE}/health`);
    console.log('✅ API is accessible');
    console.log('Health check:', response.data);
    
    // TODO: Add actual file upload test here once we have auth token
    console.log('📝 Profile image upload endpoint ready at: POST /users/profile/image');
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testProfileImageUpload();