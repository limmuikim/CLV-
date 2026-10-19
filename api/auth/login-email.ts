export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { email } = req.body || {};
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const creatorEmail = "muikimlim.insead@gmail.com";
  const isCreator = cleanEmail === creatorEmail.toLowerCase();

  const userRecord = {
    id: 1,
    uid: isCreator ? "creator_admin" : `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
    email: cleanEmail,
    displayName: isCreator ? "Mui Kim (Creator)" : cleanEmail.split("@")[0],
    role: isCreator ? "admin" : "viewer",
    status: isCreator ? "approved" : "pending"
  };

  const token = `token_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  return res.status(200).json({
    success: true,
    token,
    user: {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName
    },
    dbUser: userRecord,
    isCreator,
    isApproved: isCreator,
    creatorEmail
  });
}
