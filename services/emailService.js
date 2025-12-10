import { google } from 'googleapis';

// Initialize Gmail API client
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
);

// Set refresh token
oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

/**
 * Send group invite email via Gmail
 * @param {string} toEmail - Recipient email address
 * @param {string} groupName - Name of the group
 * @param {string} inviterName - Name of the person sending invite
 * @param {string} inviteLink - The invite link
 * @returns {Promise<boolean>} - Success status
 */
export async function sendGroupInviteEmail(toEmail, groupName, inviterName, inviteLink) {
    try {
        console.log(`[EmailService] Attempting to send invite to: ${toEmail}`);
        console.log(`[EmailService] Group: ${groupName}, Inviter: ${inviterName}`);
        
        const emailContent = `
Hello!

${inviterName} has invited you to join the group "${groupName}" on Splitwise.

Click the link below to accept the invitation:
${inviteLink}

This link will expire in 7 days.

If you don't have an account yet, you'll be prompted to sign up.

Thanks,
The Splitwise Team
        `.trim();

        const message = [
            `To: ${toEmail}`,
            'Content-Type: text/plain; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: You're invited to join "${groupName}" on Splitwise`,
            '',
            emailContent
        ].join('\n');

        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const result = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage
            }
        });

        console.log(`[EmailService] ✅ Invite email sent successfully to ${toEmail}`);
        console.log(`[EmailService] Message ID: ${result.data.id}`);
        return true;
    } catch (error) {
        console.error('[EmailService] ❌ Error sending invite email:');
        console.error('[EmailService] Error name:', error.name);
        console.error('[EmailService] Error message:', error.message);
        if (error.response) {
            console.error('[EmailService] Response status:', error.response.status);
            console.error('[EmailService] Response data:', JSON.stringify(error.response.data, null, 2));
        }
        if (error.code) {
            console.error('[EmailService] Error code:', error.code);
        }
        // Don't throw error - just log it and return false
        // This ensures invite creation still succeeds even if email fails
        return false;
    }
}

/**
 * Test Gmail API configuration
 * @returns {Promise<boolean>} - Success status
 */
export async function testGmailConnection() {
    try {
        const profile = await gmail.users.getProfile({ userId: 'me' });
        console.log('Gmail API connected successfully:', profile.data.emailAddress);
        return true;
    } catch (error) {
        console.error('Gmail API connection failed:', error.message);
        return false;
    }
}
