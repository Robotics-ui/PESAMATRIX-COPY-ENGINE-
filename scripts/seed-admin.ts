import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;

const EMAIL = "craigphilip761@gmail.com";
const TEMP_PASSWORD = "Pesa@2026!";
const FIRST_NAME = "Craig";
const LAST_NAME = "Philip";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const existing = await pool.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [EMAIL],
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.role === "admin") {
        console.log(`[seed] Admin already exists: ${EMAIL}`);
        return;
      }
      await pool.query(
        "UPDATE users SET role = 'admin', updated_at = NOW() WHERE email = $1",
        [EMAIL],
      );
      console.log(`[seed] Promoted ${EMAIL} to admin.`);
      return;
    }

    const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12);

    await pool.query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, created_at, updated_at)
       VALUES ($1, $2, 'admin', $3, $4, NOW(), NOW())`,
      [EMAIL, passwordHash, FIRST_NAME, LAST_NAME],
    );

    console.log("");
    console.log("✅  Admin seeded successfully");
    console.log("──────────────────────────────────");
    console.log(`   Email    : ${EMAIL}`);
    console.log(`   Password : ${TEMP_PASSWORD}`);
    console.log("──────────────────────────────────");
    console.log("⚠️  Change this password after first login.");
    console.log("");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[seed] Error:", err);
  process.exit(1);
});
