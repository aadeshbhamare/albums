// Shared user type so components don't depend on a specific auth provider.
export interface AppUser {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
