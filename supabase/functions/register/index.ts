import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import pg from "npm:pg@8.11.3";

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
    const { uid, username, password, email, phone, role } = await req.json();

    if (!uid || !username || !password || !email || !phone) {
      return new Response(JSON.stringify({ error: "All fields are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await client.connect();

    await client.query(`
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

    const existing = await client.query(
      `SELECT uid FROM kodusers WHERE uid = $1 OR username = $2`,
      [uid, username]
    );

    if (existing.rows.length > 0) {
      return new Response(JSON.stringify({ error: "User already exists" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await client.query(
      `INSERT INTO kodusers (uid, username, email, password, balance, phone, role) VALUES ($1, $2, $3, $4, 100000, $5, $6)`,
      [uid, username, email, password, phone, role || "Customer"]
    );

    return new Response(JSON.stringify({ message: "Registration successful" }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
