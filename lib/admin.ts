/** De super-admin ligt vast op e-mailadres (uit env SUPER_ADMIN_EMAIL) en kan
 *  niet worden verwijderd of gedegradeerd. Niet gezet = geen super-admin. */
export const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();

export function isSuperAdmin(email?: string | null): boolean {
  return !!SUPER_ADMIN_EMAIL && !!email && email.toLowerCase() === SUPER_ADMIN_EMAIL;
}

/** Admin = super-admin (op e-mail) of iemand met rol "admin". */
export function isAdmin(email?: string | null, role?: string | null): boolean {
  return isSuperAdmin(email) || role === "admin";
}
