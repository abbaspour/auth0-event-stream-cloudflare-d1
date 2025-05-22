// noinspection SqlDialectInspection

import {Hono} from 'hono';
import {bearerAuth} from 'hono/bearer-auth'

// Define interface for environment bindings
export interface Env {
    DB: any; // D1Database from Cloudflare Workers
    API_TOKEN: string
}

const app = new Hono<{ Bindings: Env }>();

/**
 * Represents a user created event from Auth0
 */
interface User {
    user_id: string;
    email?: string;
    email_verified?: boolean;
    username?: string;
    blocked?: boolean;
    family_name?: string;
    given_name?: string;
    name?: string;
    nickname?: string;
    phone_number?: string;
    phone_verified?: boolean;
    user_metadata?: {
        [key: string]: any;
    };
    app_metadata?: {
        [key: string]: any;
    };
    identities: Array<{
        connection: string;
        user_id: string;
        provider: string;
        isSocial: boolean;
    }>;
    created_at?: string;
    updated_at?: string;
    picture?: string;
}

app.use('/*', async (c, next) => {
    const auth = bearerAuth({
        token: c.env.API_TOKEN
    });
    return auth(c, next);
});

// Handle POST requests to the /events endpoint
app.post('/events', async (c) => {
    try {
        // Parse the JSON body from the request
        const eventData = await c.req.json();

        // Log the received webhook data
        console.log('Received Auth0 webhook event:', JSON.stringify(eventData, null, 2));

        const {id, type, time, data} = eventData;
        const user = data.object;

        try {
            switch (type) {
                case "user.created":
                case "user.updated":
                    await handleUserUpsert(user, time, c, type === "user.created");
                    break;
                case "user.deleted":
                    await handleUserDeleted(user, time, c);
                    break;
                default:
                    console.log(`Event type '${type}' not implemented yet.`);
            }

            console.log(`Webhook event of type '${type}' committed to the database.`);
            return new Response(null, {status: 204}); // No content response
        } catch (err) {
            console.error("Error processing webhook:", err);
            return c.json({error: "Internal server error"}, 500);
        }
    } catch (error) {
        console.error('Error processing webhook:', error);
        return c.json({error: 'Invalid JSON payload'}, 400);
    }
});

// Handle all other routes with a 404
app.notFound((c: { text: (arg0: string, arg1: number) => any; }) => c.text('Not Found', 404));

// Export default fetch handler for the worker
// noinspection JSUnusedGlobalSymbols
export default {
    fetch: app.fetch,
};

async function handleUserDeleted(user: User, time: string, c: any) {
    const {user_id} = user;

    try {
        // Use D1 database binding to execute the query with REPLACE INTO for upsert
        await c.env.DB.prepare(`
            DELETE
            FROM users
            where user_id = $1`
        )
            .bind(
                user_id
            )
            .run()
    } catch (err: any) {
        console.error(`Database error while deleting user_id=${user_id}:`, err);
        throw err;
    }
}

async function handleUserUpsert(user: User, time: string, c: any, isNewUser: boolean) {
    const {
        user_id,
        email,
        email_verified,
        username,
        blocked,
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
    const userMetadataJson = user_metadata ? JSON.stringify(user_metadata) : null;
    const appMetadataJson = app_metadata ? JSON.stringify(app_metadata) : null;
    const identitiesJson = identities ? JSON.stringify(identities) : null;

    try {
        // Use D1 database binding to execute the query with REPLACE INTO for upsert
        await c.env.DB.prepare(`
            REPLACE
            INTO users (user_id,
                           email,
                           email_verified,
                           username,
                           blocked,
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
                           last_event_processed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
            .bind(
                user_id,
                email || null,
                email_verified ?? false,
                username ?? null,
                blocked ?? false,
                family_name || null,
                given_name || null,
                name || null,
                nickname || null,
                phone_number || null,
                phone_verified ?? false,
                created_at || null,
                updated_at || null,
                picture || null,
                userMetadataJson,
                appMetadataJson,
                identitiesJson,
                rawUserJson,
                time
            )
            .run();

        console.log(`User ${user_id} successfully ${isNewUser ? 'inserted' : 'updated'} into database.`);
    } catch (err: any) {
        console.error(`Database error while upserting user_id=${user_id}:`, err);
        throw err;
    }
}
