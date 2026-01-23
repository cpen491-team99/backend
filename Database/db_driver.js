import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

// Driver for memory instance
export const memoryDriver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME,
    process.env.NEO4J_PASSWORD
  )
);

// Driver for admin instance (separate URI/creds)
export const adminDriver = neo4j.driver(
  process.env.NEO4J_ADMIN_URI,
  neo4j.auth.basic(
    process.env.NEO4J_ADMIN_USERNAME,
    process.env.NEO4J_ADMIN_PASSWORD
  )
);


// DB configs
const MEMORY_DB = process.env.NEO4J_DB || 'neo4j';
const ADMIN_DB = process.env.NEO4J_ADMIN_DB || 'neo4j';

// Default to MemoryDB
export function getSession(database = MEMORY_DB) {
  return memoryDriver.session({ database });
}

export async function runQuery(cypher, params = {}, database = MEMORY_DB) {
  const session = getSession(database);
  try {
    return await session.run(cypher, params);
  } finally {
    await session.close();
  }
}


// Admin session: methods adopted from memoryDB
export function getAdminSession(database = ADMIN_DB) {
  return adminDriver.session({ database });
}

export async function runAdminQuery(cypher, params = {}, database = ADMIN_DB) {
  const session = getAdminSession(database);
  try {
    return await session.run(cypher, params);
  } finally {
    await session.close();
  }
}

// Lazy observation of both drivers. If in session, close it. If not, do nothing. 
export async function closeDriver() {
  await Promise.all([
    memoryDriver.close(),
    adminDriver.close()
  ]);
}