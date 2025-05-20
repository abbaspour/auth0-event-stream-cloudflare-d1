// noinspection SqlDialectInspection

import { Hono } from 'hono';
import { UserCreated } from './types';

// Define interface for environment bindings
export interface Env {
  DB: D1Database;
}

// Create a new Hono app
const app = new Hono<{ Bindings: Env }>();

// Handle POST requests to the /events endpoint
app.post('/events', async (c) => {
  try {
    // Parse the JSON body from the request
    const eventData = await c.req.json();

    // Log the received webhook data
    console.log('Received Auth0 webhook event:', JSON.stringify(eventData, null, 2));

    const { id, type, time, data } = eventData;
    const user = data.object;

    try {
      switch (type) {
        case "user.created":
          await handleUserCreated(user, time, c);
          break;
        case "user.updated":
          // These functions are not implemented yet
          console.log(`Event type '${type}' not implemented yet.`);
          // await handleUserUpdated(user, time, c);
          break;
        case "user.deleted":
          // These functions are not implemented yet
          console.log(`Event type '${type}' not implemented yet.`);
          // await handleUserDeleted(user, time, c);
          break;
        default:
          // This function is not implemented yet
          console.log(`Event type '${type}' not implemented yet.`);
          // await handleDefaultEvent(id, type, time, data, c);
      }

      console.log(`Webhook event of type '${type}' committed to the database.`);
      return new Response(null, { status: 204 }); // No content response
    } catch (err) {
      console.error("Error processing webhook:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }
});

// Handle all other routes with a 404
app.notFound((c: { text: (arg0: string, arg1: number) => any; }) => c.text('Not Found', 404));

// Export default fetch handler for the worker
// noinspection JSUnusedGlobalSymbols
export default {
  fetch: app.fetch,
};


// Specific function for handling the user created event
// In this example we're making sure users are also created in our own database
async function handleUserCreated(user: UserCreated, time: string, c: any) {
  const { 
    user_id, 
    email, 
    email_verified, 
    family_name, 
    given_name, 
    name, 
    nickname, 
    phone_number, 
    phone_verified, 
    created_at, 
    updated_at, 
    picture,
    user_metadata,
    app_metadata,
    identities
  } = user;

  // Convert user object to JSON string for storage
  const rawUserJson = JSON.stringify(user);

  // Convert complex objects to JSON strings for storage
  const userMetadataJson = JSON.stringify(user_metadata);
  const appMetadataJson = JSON.stringify(app_metadata);
  const identitiesJson = JSON.stringify(identities);

  try {
    // Use D1 database binding to execute the query
    await c.env.DB.prepare(`
      INSERT INTO users (
        user_id, 
        email, 
        email_verified, 
        family_name, 
        given_name, 
        name, 
        nickname, 
        phone_number, 
        phone_verified, 
        created_at, 
        updated_at, 
        picture, 
        user_metadata,
        app_metadata,
        identities,
        raw_user, 
        last_event_processed
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      user_id,
      email,
      email_verified,
      family_name || null,
      given_name || null,
      name,
      nickname,
      phone_number || null,
      phone_verified,
      created_at,
      updated_at,
      picture || null,
      userMetadataJson,
      appMetadataJson,
      identitiesJson,
      rawUserJson,
      time
    )
    .run();

    console.log(`User ${user_id} successfully inserted into database.`);
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      console.error(`Duplicate user_id=${user_id}, skipping insert.`);
    } else {
      console.error(`Database error while creating user_id=${user_id}:`, err);
      throw err;
    }
  }
}
