import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const dbUrl = Deno.env.get("AIVEN_DB_URL")!;
    const pool = new Pool(dbUrl, 3, true);
    const connection = await pool.connect();

    try {
      // Create table if not exists
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

      // Check if user already exists
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
