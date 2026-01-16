import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

export const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME,
    process.env.NEO4J_PASSWORD
  )
);

export function getSession(database = 'neo4j') {
  return driver.session({ database });
}

export async function runQuery(cypher, params = {}, database = 'neo4j') {
  const session = getSession(database);
  try {
    return await session.run(cypher, params);
  } finally {
    await session.close();
  }
}

export async function closeDriver() {
  await driver.close();
}