module.exports = function emailOtpTemplate(otp) {
  return `
    <div>
      <h2>Your MitosLearning OTP</h2>
      <p>Your verification code is:</p>
      <h1 style="font-size: 28px">${otp}</h1>
      <p>This OTP will expire in 5 minutes.</p>
    </div>
  `;
};
