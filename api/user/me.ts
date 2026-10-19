export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization || "";
  const creatorEmail = "muikimlim.insead@gmail.com";

  return res.status(200).json({
    authenticated: Boolean(authHeader),
    creatorEmail,
    timestamp: new Date().toISOString()
  });
}
