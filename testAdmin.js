// ...existing code...
import * as adminStore from './Database/admin_store.js';
import * as adminQuery from './Database/admin_query.js';
import { closeDriver } from './Database/db_driver.js';

async function main() {
  try {
    // Storage Test
    // await adminStore.initSchema();
    // await adminStore.saveUser(...);
    // await adminStore.saveAgent(...);
    // await adminStore.saveChatroom(...);
    // await adminStore.saveMessage(...);

    const before = new Date().toISOString();

    console.log('\n=== Chatrooms ===');
    const rooms = await adminQuery.listChatrooms();
    const roomsForPrint = rooms.map(({ createdAt, updatedAt, ...rest }) => rest);
    console.dir(roomsForPrint, { depth: null });

    console.log('\n=== Users ===');
    const allUsers = await adminQuery.listUsers();
    const usersForPrint = allUsers.map(({ createdAt, updatedAt, ...rest }) => rest);
    console.dir(usersForPrint, { depth: null });

    console.log('\n=== Messages from user u1 (latest 10) ===');
    const u1Messages = await adminQuery.listMessagesBySender({
      senderId: 'u1',
      limit: 10,
      before,
    });
    const u1msgForPrint = u1Messages.map(({ createdAt, updatedAt, ...rest }) => rest);
    console.dir(u1msgForPrint, { depth: null });

    console.log('\n=== Messages from agent a1 (latest 10) ===');
    const a1Messages = await adminQuery.listMessagesBySender({
      senderId: 'a1',
      senderIsUser: false,
      limit: 10,
      before,
    });
    const a1msgForPrint = a1Messages.map(({ createdAt, updatedAt, ...rest }) => rest);
    console.dir(a1msgForPrint, { depth: null });

    console.log('\n=== Messages in chatroom r1 (latest 10) ===');
    const r1Messages = await adminQuery.listMessagesByChatroom({
      chatroomId: 'r1',
      limit: 10,
      before,
    });
    const r1msgForPrint = r1Messages.map(({ createdAt, updatedAt, ...rest }) => rest);
    console.dir(r1msgForPrint, { depth: null });

    console.log('\n=== Messages in chatroom r2 (latest 10) ===');
    const r2Messages = await adminQuery.listMessagesByChatroom({
      chatroomId: 'r2',
      limit: 10,
      before,
    });
    const r2msgForPrint = r2Messages.map(({ createdAt, updatedAt, ...rest }) => rest);
    console.dir(r2msgForPrint, { depth: null });

    console.log('\nDone.');
  } catch (err) {
    console.error('Error in test_admin:', err);
  } finally {
    await closeDriver();
  }
}

main();