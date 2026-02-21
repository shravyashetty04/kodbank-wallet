import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import pg from "npm:pg@8.11.3";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getClient() {
  return new pg.Client({
    connectionString: Deno.env.get("AIVEN_DB_URL")!,
    ssl: { rejectUnauthorized: false },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const client = getClient();
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Username and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await client.connect();

    const result = await client.query(
      `SELECT uid, username, role, password FROM kodusers WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = result.rows[0];

    if (user.password !== password) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const secretKey = Deno.env.get("JWT_SECRET_KEY")!;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const key = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
    );

    const expiry = getNumericDate(60 * 60 * 24);

    const token = await create(
      { alg: "HS256", typ: "JWT" },
      { sub: user.username, role: user.role, exp: expiry },
      key
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS "CWJT" (
        tid SERIAL PRIMARY KEY,
        token TEXT NOT NULL,
        uid VARCHAR(50) REFERENCES kodusers(uid),
        expairy BIGINT
      )
    `);

    await client.query(
      `INSERT INTO "CWJT" (token, uid, expairy) VALUES ($1, $2, $3)`,
      [token, user.uid, expiry]
    );

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "application/json");
    headers.set("Set-Cookie", `kodbank_token=${token}; Path=/; Max-Age=86400; SameSite=Lax`);

    return new Response(JSON.stringify({ message: "Login successful", token }), {
      status: 200,
      headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    await client.end();
  }
});
