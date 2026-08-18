const rateLimit = require("express-rate-limit");

const limitRequests = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 requests per window
  message: "Too many requests, please try again later.",
});

module.exports = limitRequests;
