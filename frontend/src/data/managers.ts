/** The named managers who can act as "Manager" in the actor switcher. Purely a display/
 * identity convenience for the "Viewing as" dropdown - all managers share the same
 * `{ role: 'manager' }` permissions (see ActorContext), there is no per-manager backend
 * distinction or attribution anywhere in the app.
 */
export const MANAGER_NAMES = ['Jan Willems', 'Rubendran Ambihaipahan', 'Elvin Edgar']
