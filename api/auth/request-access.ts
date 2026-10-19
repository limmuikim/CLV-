export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const { email, name, note } = body || {};
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const creatorEmail = "muikimlim.insead@gmail.com";
  const isCreator = cleanEmail === creatorEmail.toLowerCase();

  const userRecord = {
    uid: isCreator ? "creator_admin" : `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: cleanEmail,
    name: name || cleanEmail.split("@")[0],
    note: note || "",
    role: isCreator ? "admin" : "viewer",
    status: isCreator ? "approved" : "pending",
    createdAt: new Date().toISOString()
  };

  return res.status(200).json({
    success: true,
    user: userRecord,
    isCreator,
    isApproved: isCreator,
    creatorEmail,
    message: isCreator
      ? "Welcome Creator! Access granted."
      : `Your access request has been recorded. Please also drop an email to ${creatorEmail} to expedite approval.`
  });
}
