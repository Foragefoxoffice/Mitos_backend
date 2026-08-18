// templates/welcomeEmail.js
module.exports = (name, buttonUrl) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Mitos Learning</title>
  <style>
    body {
      font-family: 'Poppins', Arial, sans-serif;
      background-color: #f9f9f9;
      margin: 0;
      padding: 0;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }
    .header {
      background: linear-gradient(135deg, #007bff, #00c4ff);
      text-align: center;
      padding: 35px 20px;
      color: #fff;
    }
    .header img {
      width: 100px;
      margin-bottom: 10px;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: bold;
    }
    .content {
      padding: 30px 20px 40px;
      text-align: left;
    }
    .content h2 {
      color: #007bff;
      font-size: 22px;
      margin-bottom: 10px;
    }
    .content p {
      font-size: 15px;
      line-height: 1.6;
      margin: 10px 0 20px;
      color: #555;
    }
    .cta-button {
      display: inline-block;
      padding: 12px 30px;
      background: #007bff;
      color: #fff;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: background 0.3s;
    }
    .cta-button:hover {
      background: #0056b3;
    }
    .footer {
      background: #f2f2f2;
      padding: 15px;
      text-align: center;
      font-size: 13px;
      color: #777;
    }
    .footer a {
      color: #007bff;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://mitoslearning.com/images/logo/logo.png" alt="Mitos Learning Logo" />
      <h1>Welcome to Mitos Learning</h1>
    </div>
    <div class="content">
      <h2>Hi ${name || "Student"},</h2>
      <p>
        Congratulations! You’ve taken a powerful step toward your NEET dreams by joining Mitos Learning.
      </p>
      <p>
        At Mitos Learning, we are dedicated to helping you ace NEET with clarity, confidence, and consistency.
        Whether it’s mastering Biology, Chemistry, or Physics, we’re here for you — every step of the way.
      </p>
      <p style="text-align:center;">
        <a href="https://mitoslearning.com/user/dashboard" style="color:#fff" class="cta-button">Start Learning</a>
      </p>
      <p>
        If you need help or guidance, reach out — we’re always here for you.
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Mitos Learning. All rights reserved.</p>
      <p>Need help? <a href="mailto:support@mitoslearning.com">Contact Support</a></p>
    </div>
  </div>
</body>
</html>
`;
