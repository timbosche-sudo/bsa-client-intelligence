/**
 * Authentication interface placeholder.
 *
 * Prototype Mode has NO authentication or authorization. The role below only shapes the UI and must
 * not be described as access control. Production will implement this interface with Microsoft Entra ID
 * (MSAL) and enforce authorization server-side.
 */
export type AppRole = 'administrator' | 'client_team_lead' | 'member' | 'viewer';

export interface SessionUser {
  id: string;
  displayName: string;
  email: string | null;
  role: AppRole;
  authenticated: boolean;
}

export interface AuthProvider {
  getCurrentUser(): SessionUser;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

export const prototypeAuth: AuthProvider = {
  getCurrentUser: () => ({
    id: 'prototype-user',
    displayName: 'Prototype User',
    email: null,
    role: 'administrator',
    authenticated: false,
  }),
  signIn: async () => {
    throw new Error('Sign-in is not available in Prototype Mode. Microsoft Entra ID integration is planned for production.');
  },
  signOut: async () => undefined,
};
