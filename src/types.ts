/**
 * Type definitions for Auth0 event stream objects
 */

/**
 * Represents a user created event from Auth0
 */
export interface User {
  user_id: string;
  email?: string;
  email_verified?: boolean;
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
  identities?: Array<{
    connection: string;
    user_id: string;
    provider: string;
    isSocial: boolean;
  }>;
  created_at?: string;
  updated_at?: string;
  picture?: string;
}
