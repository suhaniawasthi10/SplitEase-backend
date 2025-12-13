import { createTransport } from 'nodemailer';

/**
 * Email Service for sending group invitations
 * Uses Gmail SMTP with App Password authentication
 * 
 * Environment variables required:
 * - GMAIL_USER: Gmail address to send from
 * - GMAIL_APP_PASSWORD: Gmail App Password (16 characters, spaces allowed)
 */

/**
 * Create email transporter with Gmail SMTP configuration
 * Uses lazy initialization to ensure environment variables are loaded
 * @private
 * @returns {object} Nodemailer transporter instance
 */
function getTransporter() {
    return createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // Use STARTTLS
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '') // Remove spaces from app password
        }
    });
}

/**
 * Send group invitation email
 * @param {string} toEmail - Recipient email address
 * @param {string} groupName - Name of the group
 * @param {string} inviterName - Name of the person sending invite
 * @param {string} inviteLink - The invite link (expires in 7 days)
 * @returns {Promise<boolean>} - Returns true if email sent successfully, false otherwise
 */
export async function sendGroupInviteEmail(toEmail, groupName, inviterName, inviteLink) {
    try {
        const transporter = getTransporter();

        const mailOptions = {
            from: `"Splitwise" <${process.env.GMAIL_USER}>`,
            to: toEmail,
            subject: `You're invited to join "${groupName}" on Splitwise`,
            // Plain text version for email clients that don't support HTML
            text: `Hello!

${inviterName} has invited you to join the group "${groupName}" on Splitwise.

Click the link below to accept the invitation:
${inviteLink}

This link will expire in 7 days.

If you don't have an account yet, you'll be prompted to sign up.

Thanks,
The Splitwise Team`,
            // HTML version with styling
            html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 You're Invited!</h1>
        </div>
        <div class="content">
            <p>Hello!</p>
            <p><strong>${inviterName}</strong> has invited you to join the group <strong>"${groupName}"</strong> on Splitwise.</p>
            <p>Click the button below to accept the invitation:</p>
            <a href="${inviteLink}" class="button">Accept Invitation</a>
            <p style="color: #6b7280; font-size: 14px;">Or copy this link: <br>${inviteLink}</p>
            <p style="color: #f59e0b; font-size: 14px;">⚠️ This link will expire in 7 days.</p>
            <p>If you don't have an account yet, you'll be prompted to sign up.</p>
        </div>
        <div class="footer">
            <p>Thanks,<br>The Splitwise Team</p>
        </div>
    </div>
</body>
</html>
            `
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        // Log error but don't throw - allows invite creation to succeed even if email fails
        if (error.code) {
        }
        return false;
    }
}

/**
 * Test email service configuration
 * Useful for debugging email setup issues
 * @returns {Promise<boolean>} - Returns true if configuration is valid
 */
export async function testEmailConnection() {
    try {
        const transporter = getTransporter();
        await transporter.verify();
        return true;
    } catch (error) {
        return false;
    }
}
