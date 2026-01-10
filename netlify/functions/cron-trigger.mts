import { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  // Only allow POST or GET as per the requirements
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ message: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Netlify functions don't have the full backend logic, 
  // so we redirect the request to the Replit app where the actual logic resides.
  // This solves the 'Method Not Allowed' if the user was trying to call it on Netlify.
  
  const replitUrl = process.env.REPLIT_APP_URL;
  if (!replitUrl) {
    return new Response(JSON.stringify({ message: "REPLIT_APP_URL not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const targetUrl = `${replitUrl}${new URL(req.url).pathname}`;
    const headers = new Headers(req.headers);
    headers.set("Host", new URL(replitUrl).host);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method === "POST" ? await req.text() : undefined
    });

    const contentType = response.headers.get("content-type");
    const data = await response.text();
    
    return new Response(data, {
      status: response.status,
      headers: {
        "Content-Type": contentType || "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ message: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
