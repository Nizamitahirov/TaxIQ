import { listCompanies, getCompaniesByIds, getCompany } from './companies';
import { getRole } from './roles';
import { listAccessForUser } from './users';
import { resolveRolePermissions, SYSTEM_ROLE_MAP, ALL_PERMISSION_IDS } from '@/lib/rbac/permissions';
import type { ActiveMembership, AppUser, Company, Role } from '@/types';

/** Rol sənədini (sistem və ya custom) effektiv icazə dəstinə çevirir */
async function roleToPermissions(roleId: string): Promise<{ name: string; perms: Set<string> }> {
  // Sistem rolu (kod ilə)?
  const sys = SYSTEM_ROLE_MAP[roleId];
  if (sys) return { name: sys.name.az, perms: resolveRolePermissions(sys) };
  // Firestore-dakı rol
  const role = await getRole(roleId);
  if (!role) return { name: roleId, perms: new Set() };
  return { name: role.name, perms: resolveRolePermissions(role as Role) };
}

function applyOverrides(base: Set<string>, add?: string[], remove?: string[]): Set<string> {
  const s = new Set(base);
  for (const a of add ?? []) s.add(a);
  for (const r of remove ?? []) s.delete(r);
  return s;
}

/**
 * İstifadəçinin bütün aktiv membership-lərini (şirkət + rol + effektiv icazələr) hesablayır.
 * — Super Admin: bütün şirkətlər, tam icazə (01 §0.2)
 * — Staff: userCompanyAccess cədvəlindəki təyinatlar
 * — Client User: yalnız homeCompanyId
 */
export async function resolveMemberships(user: AppUser): Promise<ActiveMembership[]> {
  if (user.userType === 'platform_super_admin') {
    const companies = await listCompanies();
    const allPerms = new Set(ALL_PERMISSION_IDS);
    return companies.map((c) => ({
      companyId: c.id,
      company: c,
      roleId: 'platform_super_admin',
      roleName: SYSTEM_ROLE_MAP.platform_super_admin.name.az,
      permissions: allPerms,
    }));
  }

  if (user.userType === 'client_user') {
    if (!user.homeCompanyId) return [];
    const company = await getCompany(user.homeCompanyId);
    if (!company) return [];
    // Client user-in rolu da userCompanyAccess-də saxlanılır
    const access = (await listAccessForUser(user.uid)).find((a) => a.companyId === company.id);
    const roleId = access?.roleId ?? 'viewer';
    const { name, perms } = await roleToPermissions(roleId);
    return [{
      companyId: company.id,
      company,
      roleId,
      roleName: name,
      permissions: applyOverrides(perms, access?.customPermissionOverrides?.add, access?.customPermissionOverrides?.remove),
    }];
  }

  // staff
  const accessDocs = await listAccessForUser(user.uid);
  if (accessDocs.length === 0) return [];
  const companies = await getCompaniesByIds(accessDocs.map((a) => a.companyId));
  const companyMap = new Map<string, Company>(companies.map((c) => [c.id, c]));

  const memberships: ActiveMembership[] = [];
  for (const a of accessDocs) {
    const company = companyMap.get(a.companyId);
    if (!company) continue;
    const { name, perms } = await roleToPermissions(a.roleId);
    memberships.push({
      companyId: a.companyId,
      company,
      roleId: a.roleId,
      roleName: name,
      permissions: applyOverrides(perms, a.customPermissionOverrides?.add, a.customPermissionOverrides?.remove),
    });
  }
  return memberships;
}
