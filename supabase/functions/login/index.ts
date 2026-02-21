import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Username and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dbUrl = Deno.env.get("AIVEN_DB_URL")!;
    const pool = new Pool(dbUrl, 3, true);
    const connection = await pool.connect();

    try {
      const result = await connection.queryObject<{ uid: string; username: string; role: string; password: string }>(
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

      // Generate JWT
      const secretKey = Deno.env.get("JWT_SECRET_KEY")!;
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secretKey);
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
      );

      const expiry = getNumericDate(60 * 60 * 24); // 24 hours

      const token = await create(
        { alg: "HS256", typ: "JWT" },
        { sub: user.username, role: user.role, exp: expiry },
        key
      );

      // Create CWJT table if not exists and store token
      await connection.queryObject(`
        CREATE TABLE IF NOT EXISTS "CWJT" (
          tid SERIAL PRIMARY KEY,
          token TEXT NOT NULL,
          uid VARCHAR(50) REFERENCES kodusers(uid),
          expairy BIGINT
        )
      `);

      await connection.queryObject(
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
