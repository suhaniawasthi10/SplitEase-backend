import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Ensure environment variables are loaded
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Debug: Log if API key is found
console.log('🔧 Cloudinary Config Debug:');
console.log('   ENV Path:', envPath);
console.log('   Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? '✓ Set' : '✗ Missing');
console.log('   API Key:', process.env.CLOUDINARY_API_KEY ? '✓ Set' : '✗ Missing');
console.log('   API Secret:', process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '✗ Missing');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
