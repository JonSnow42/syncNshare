const handleRequest = require("../server");

module.exports = function apiHandler(req, res) {
  // Vercel rewrites every /api/* request here and passes the original API
  // path in __route. Restore it so the existing server router sees its usual
  // /api/... URL, while preserving any query parameters from the request.
  const route = req.query?.__route;
  if (typeof route === "string") {
    const incoming = new URL(req.url || "/", "http://localhost");
    incoming.searchParams.delete("__route");
    const query = incoming.searchParams.toString();
    req.url = `/api/${route}${query ? `?${query}` : ""}`;
  }

  return handleRequest(req, res);
};
