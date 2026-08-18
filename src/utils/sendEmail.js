// utils/sendEmail.js
const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, html, textFallback = "") => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // Gmail uses STARTTLS on port 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Build a clean email
    const mailOptions = {
      from: `"Mitos Learning" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text:
        textFallback ||
        "Welcome to Mitos Learning! Start your NEET preparation journey today.",
      replyTo: "mitoslearning@gmail.com", // ✅ Adds credibility
      headers: {
        "X-Entity-Ref-ID": "MitosLearning", // Helps Gmail thread grouping
      },
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
  }
};

module.exports = sendEmail;
