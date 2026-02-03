import { runQuery, closeDriver } from './Database/db_driver.js';

async function main() {
  try {
    // 1) Simple connectivity test
    const ping = await runQuery('RETURN 1 AS num');
    console.log('Ping:', ping.records[0].get('num')); // should print 1

    // 2) Create a node
    const createUser = await runQuery(
      'CREATE (u:User {id: $id, name: $name}) RETURN u',
      { id: 'u1', name: 'Lissandra' }
    );
    console.log('Created user:', createUser.records[0].get('u').properties);

    // 3) Read nodes
    const users = await runQuery('MATCH (u:User) RETURN u LIMIT 10');
    console.log(
      'All users:',
      users.records.map(r => r.get('u').properties)
    );

    // 4) Create a relationship example
    await runQuery(
      `
      MERGE (u:User {id: $uid})
      MERGE (p:Project {id: $pid, name: $pname})
      MERGE (u)-[:WORKS_ON]->(p)
      `,
      { uid: 'u1', pid: 'p1', pname: 'Agentic Project' }
    );
    console.log('Created WORKS_ON relationship');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await closeDriver();
  }
}

main();