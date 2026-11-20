let checkoutScript;

window.kaamgharOpenPayment = async (options, success, dismiss, fail) => {
  try {
    if (!window.Razorpay) {
      checkoutScript ??= new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = resolve;
        script.onerror = () => {
          checkoutScript = undefined;
          script.remove();
          reject(new Error("Could not load Razorpay checkout."));
        };
        document.head.append(script);
      });
      await checkoutScript;
    }
    const checkout = new window.Razorpay({
      ...options,
      handler: (result) => success(
        result.razorpay_order_id, result.razorpay_payment_id, result.razorpay_signature
      ),
      modal: { ondismiss: dismiss },
    });
    checkout.on("payment.failed", (result) => {
      fail(result.error?.description || "Payment failed.");
      checkout.close();
    });
    checkout.open();
  } catch (error) {
    fail(error.message || "Could not open checkout.");
  }
};
