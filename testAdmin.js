import {
  initSchema,
  saveUser,
  saveAgent,
  saveChatroom,
  saveMessage,
} from './Database/admin_store.js';
import {
  listChatrooms,
  listUsers,
  listMessagesBySender,
} from './Database/admin_query.js';
import { closeDriver } from './Database/db_driver.js';

async function main() {
  try {
    console.log('Initializing schema...');
    await initSchema();

    console.log('Creating users...');
    const users = [
      {
        id: 'u1',
        username: 'alice',
        email: 'alice@example.com',
        preferences: { theme: 'light', language: 'en' },
      },
      {
        id: 'u2',
        username: 'bob',
        email: 'bob@example.com',
        preferences: { theme: 'dark', language: 'en' },
      },
      {
        id: 'u3',
        username: 'carol',
        email: 'carol@example.com',
        preferences: { theme: 'light', language: 'fr' },
      },
    ];
    for (const u of users) {
      await saveUser(u);
    }

    console.log('Creating agents (1-1 with users)...');
    const agents = [
      {
        id: 'a1',
        uid: 'u1',
        agentname: 'alice-bot',
        persona: 'Helpful assistant for Alice',
      },
      {
        id: 'a2',
        uid: 'u2',
        agentname: 'bob-bot',
        persona: 'Productivity coach for Bob',
      },
      {
        id: 'a3',
        uid: 'u3',
        agentname: 'carol-bot',
        persona: 'French learning companion for Carol',
      },
    ];
    for (const a of agents) {
      await saveAgent(a);
    }

    console.log('Creating chatrooms...');
    const chatrooms = [
      { id: 'r1', roomname: 'lobby' },
      { id: 'r2', roomname: 'park' },
      { id: 'r3', roomname: 'alley' },
    ];
    for (const c of chatrooms) {
      await saveChatroom(c);
    }

    console.log('Creating messages...');
    // Some messages from users
    await saveMessage({
      id: 'm1',
      text: 'Hello from Alice in lobby',
      senderId: 'u1',
      chatroomId: 'r1',
    });
    await saveMessage({
      id: 'm2',
      text: 'Bob checking in on park',
      senderId: 'u2',
      chatroomId: 'r2',
    });
    await saveMessage({
      id: 'm3',
      text: 'Carol hanging out in alley',
      senderId: 'u3',
      chatroomId: 'r3',
    });

    // Some messages from agents
    await saveMessage({
      id: 'm4',
      text: 'alice-bot here to help!',
      senderId: 'a1',
      chatroomId: 'r1',
      senderIsUser: false,
    });
    await saveMessage({
      id: 'm5',
      text: 'bob-bot answering your ticket.',
      senderId: 'a2',
      chatroomId: 'r2',
      senderIsUser: false,
    });
    await saveMessage({
      id: 'm6',
      text: 'carol-bot suggests a new exercise.',
      senderId: 'a3',
      chatroomId: 'r3',
      senderIsUser: false,
    });

    // Use a "before" timestamp for the message query (optional)
    const before = new Date().toISOString();

    console.log('\n=== Chatrooms ===');
    const rooms = await listChatrooms();
    console.dir(rooms, { depth: null });

    console.log('\n=== Users ===');
    const allUsers = await listUsers();
    console.dir(allUsers, { depth: null });

    console.log('\n=== Messages from user u1 (latest 10) ===');
    const u1Messages = await listMessagesBySender({
      senderId: 'u1',
      limit: 10,
      before,
    });
    console.dir(u1Messages, { depth: null });

    console.log('\n=== Messages from agent a1 (latest 10) ===');
    const a1Messages = await listMessagesBySender({
      senderId: 'a1',
      senderIsUser: false,
      limit: 10,
      before,
    });
    console.dir(a1Messages, { depth: null });

    console.log('\nDone.');
  } catch (err) {
    console.error('Error in test_admin:', err);
  } finally {
    await closeDriver();
  }
}

main();