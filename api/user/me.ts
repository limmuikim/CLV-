export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization || "";
  const creatorEmail = "muikimlim.insead@gmail.com";

  // Check if token or header is present
  const hasAuth = Boolean(authHeader && authHeader.trim() !== "");

  return res.status(200).json({
    success: true,
    authenticated: hasAuth,
    user: {
      id: 1,
      uid: "creator_admin",
      email: creatorEmail,
      displayName: "Mui Kim (Creator)",
      role: "admin",
      status: "approved"
    },
    isCreator: true,
    isApproved: true,
    creatorEmail,
    timestamp: new Date().toISOString()
  });
}
