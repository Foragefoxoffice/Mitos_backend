jest.mock("../utils/sendWhatsapp", () => ({
  sendWhatsappTemplate: jest.fn(),
  isWhatsappConfigured: jest.fn(() => true),
}));
const { sendWhatsappTemplate, isWhatsappConfigured } = require("../utils/sendWhatsapp");
const { notifyOtpLogin } = require("./loginNotification");

describe("notifyOtpLogin", () => {
  const env = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    process.env = { ...env, WHATSAPP_LOGIN_TEMPLATE: "after_otp" };
  });
  afterAll(() => { process.env = env; });

  it("sends the configured template to the user's phone", async () => {
    await notifyOtpLogin("+919876543210");
    expect(sendWhatsappTemplate).toHaveBeenCalledWith({ to: "+919876543210", name: "after_otp", languageCode: "en_US" });
  });

  it("skips when the template env is not set", async () => {
    delete process.env.WHATSAPP_LOGIN_TEMPLATE;
    await notifyOtpLogin("+919876543210");
    expect(sendWhatsappTemplate).not.toHaveBeenCalled();
  });

  it("skips users without a phone number", async () => {
    await notifyOtpLogin(null);
    expect(sendWhatsappTemplate).not.toHaveBeenCalled();
  });

  it("skips when WhatsApp is not configured", async () => {
    isWhatsappConfigured.mockReturnValueOnce(false);
    await notifyOtpLogin("+919876543210");
    expect(sendWhatsappTemplate).not.toHaveBeenCalled();
  });

  it("never throws when the send fails", async () => {
    sendWhatsappTemplate.mockRejectedValueOnce(new Error("132001 template not found"));
    await expect(notifyOtpLogin("+919876543210")).resolves.toBeUndefined();
  });
});
