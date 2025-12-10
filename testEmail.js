import { testGmailConnection, sendGroupInviteEmail } from './services/emailService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testEmailService() {
    console.log('Testing Gmail API connection...\n');
    
    // Test 1: Check Gmail API connection
    const connectionOk = await testGmailConnection();
    
    if (!connectionOk) {
        console.error('\n❌ Gmail API connection failed. Please check your credentials in .env file:');
        console.error('- GOOGLE_CLIENT_ID');
        console.error('- GOOGLE_CLIENT_SECRET');
        console.error('- GOOGLE_REFRESH_TOKEN');
        console.error('\nMake sure you have enabled Gmail API and generated OAuth2 credentials.');
        process.exit(1);
    }
    
    console.log('\n✅ Gmail API connection successful!\n');
    
    // Test 2: Send a test invite email
    const testEmail = process.argv[2];
    
    if (!testEmail) {
        console.log('Usage: node testEmail.js <email_address>');
        console.log('Example: node testEmail.js test@example.com');
        process.exit(0);
    }
    
    console.log(`Sending test invite email to: ${testEmail}\n`);
    
    const success = await sendGroupInviteEmail(
        testEmail,
        'Test Group',
        'Test User',
        'http://localhost:5173/invite/test-token-123'
    );
    
    if (success) {
        console.log('\n✅ Test email sent successfully!');
        console.log(`Check ${testEmail} inbox (and spam folder).`);
    } else {
        console.log('\n❌ Failed to send test email. Check the error logs above.');
    }
}

testEmailService();
