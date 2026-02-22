import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatPEM(raw: string): string {
  let cert = raw.replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");
  const lines = cert.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----`;
}

function getPoolConfig() {
  const raw = Deno.env.get("AIVEN_DB_URL")!;
  const dbUrl = new URL(raw);
  const ca = formatPEM(Deno.env.get("AIVEN_CA_CERT")!);
  return {
    hostname: dbUrl.hostname,
    port: parseInt(dbUrl.port) || 5432,
    database: dbUrl.pathname.slice(1),
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    tls: {
      enabled: true,
      enforce: true,
      caCertificates: [ca],
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No token provided" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const secretKey = Deno.env.get("JWT_SECRET_KEY")!;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const key = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
    );

    let payload;
    try {
      payload = await verify(token, key);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const username = payload.sub as string;

    const pool = new Pool(getPoolConfig(), 3, true);
    const connection = await pool.connect();

    try {
      const tokenCheck = await connection.queryObject(
        `SELECT tid FROM "CWJT" WHERE token = $1`,
        [token]
      );

      if (tokenCheck.rows.length === 0) {
        return new Response(JSON.stringify({ error: "Token not found in database" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await connection.queryObject<{ balance: number }>(
        `SELECT balance FROM kodusers WHERE username = $1`,
        [username]
      );

      if (result.rows.length === 0) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ balance: result.rows[0].balance }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      connection.release();
      await pool.end();
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
