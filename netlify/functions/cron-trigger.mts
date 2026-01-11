import { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  // Allow all methods for general proxying
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-cron-secret"
      }
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
    console.log(`Proxying ${req.method} request to: ${targetUrl}`);
    
    const headers = new Headers();
    // Copy essential headers
    const headersToCopy = ['authorization', 'content-type', 'x-cron-secret'];
    for (const headerName of headersToCopy) {
      const value = req.headers.get(headerName);
      if (value) headers.set(headerName, value);
    }
    
    headers.set("Host", new URL(replitUrl).host);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: (req.method !== "GET" && req.method !== "HEAD") ? await req.text() : undefined
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
