import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatPEM(raw: string): string {
  // Remove any existing headers/footers and whitespace
  let cert = raw.replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");
  // Re-wrap to 64-char lines
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
    const { uid, username, password, email, phone, role } = await req.json();

    if (!uid || !username || !password || !email || !phone) {
      return new Response(JSON.stringify({ error: "All fields are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pool = new Pool(getPoolConfig(), 3, true);
    const connection = await pool.connect();

    try {
      await connection.queryObject(`
        CREATE TABLE IF NOT EXISTS kodusers (
          uid VARCHAR(50) PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          email VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL,
          balance NUMERIC DEFAULT 100000,
          phone VARCHAR(20),
          role VARCHAR(20) DEFAULT 'Customer'
        )
      `);

      const existing = await connection.queryObject(
        `SELECT uid FROM kodusers WHERE uid = $1 OR username = $2`,
        [uid, username]
      );

      if (existing.rows.length > 0) {
        return new Response(JSON.stringify({ error: "User already exists" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await connection.queryObject(
        `INSERT INTO kodusers (uid, username, email, password, balance, phone, role) VALUES ($1, $2, $3, $4, 100000, $5, $6)`,
        [uid, username, email, password, phone, role || "Customer"]
      );

      return new Response(JSON.stringify({ message: "Registration successful" }), {
        status: 201,
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
