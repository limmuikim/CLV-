export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { targetUserId, customerId, amount, date } = req.body || {};
  return res.status(200).json({
    success: true,
    message: "Webhook order ingested.",
    order: {
      customerId: customerId || "CUST-SIM",
      amount: amount || 50,
      date: date || new Date().toISOString().split("T")[0]
    }
  });
}
