import { handlers } from "@/lib/auth";

// Vangt /api/auth/signin, /api/auth/callback/resend, /api/auth/signout enzovoort.
export const { GET, POST } = handlers;
