export interface Account {
  userId: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
}
/** An account this device can sign back into without asking for credentials. */
export interface RememberedAccount extends Account {
  switchToken: string;
}
export interface Session {
  userId: string | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  /** The active account first, then the others remembered on this device. */
  accounts: Account[];
  switchAccount: (userId: string) => Promise<void>;
  /** Keeps the active account on this device and opens sign-in for another one. */
  addAccount: () => Promise<void>;
  /** Logs out the active account; another remembered account takes over. */
  signOut: () => Promise<void>;
}
/** The parts of a Clerk user that an account row needs. */
export interface UserLike {
  id: string;
  fullName: string | null;
  username: string | null;
  imageUrl: string;
  primaryEmailAddress: { emailAddress: string } | null;
}
