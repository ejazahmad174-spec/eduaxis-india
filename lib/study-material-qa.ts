export type StudyMaterialQaConfig = {
  enabled: boolean;
  webhookReady: boolean;
  qaUserId: string;
  keyId: string;
  keySecret: string;
  webhookSecret: string;
};

export function getStudyMaterialQaConfig(): StudyMaterialQaConfig {
  const qaUserId = process.env.RAZORPAY_PDF_TEST_QA_USER_ID || "";
  const keyId = process.env.RAZORPAY_TEST_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_TEST_KEY_SECRET || "";
  const webhookSecret = process.env.RAZORPAY_TEST_WEBHOOK_SECRET || "";
  const featureEnabled = process.env.RAZORPAY_PDF_TEST_ENABLED === "true";
  const isTestKey = keyId.startsWith("rzp_test_");

  const fullyConfigured = Boolean(
    featureEnabled && qaUserId && isTestKey && keySecret && webhookSecret
  );

  return {
    enabled: fullyConfigured,
    webhookReady: fullyConfigured,
    qaUserId,
    keyId,
    keySecret,
    webhookSecret,
  };
}
