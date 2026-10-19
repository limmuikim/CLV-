export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const creatorEmail = "muikimlim.insead@gmail.com";

  return res.status(200).json({
    users: [
      {
        id: 1,
        uid: "creator_admin",
        email: creatorEmail,
        role: "admin",
        status: "approved",
        createdAt: new Date().toISOString()
      }
    ]
  });
}
