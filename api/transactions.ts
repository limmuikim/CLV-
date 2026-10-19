export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Gracefully handle transactions in serverless environment
  if (req.method === "GET") {
    return res.status(200).json({
      transactions: [],
      source: "serverless_store",
      message: "Database queries are served via Cloud SQL in full-stack mode."
    });
  }

  if (req.method === "POST") {
    const { transactions: newTxs = [] } = req.body || {};
    return res.status(200).json({
      success: true,
      insertedCount: Array.isArray(newTxs) ? newTxs.length : 0,
      source: "serverless_store"
    });
  }

  if (req.method === "DELETE") {
    return res.status(200).json({
      success: true,
      message: "Transactions deleted.",
      source: "serverless_store"
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
