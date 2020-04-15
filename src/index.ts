import { promises as fs } from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { argv } from 'yargs';

const schemaPath =
  typeof argv.metadata === 'string'
    ? path.resolve(process.cwd(), argv.metadata)
    : path.resolve(__dirname, 'metadata.yaml');

interface HasuraSchema {
  version: number;
  tables: Array<HasuraTable>;
  functions: Array<any>;
  remote_schemas: Array<any>;
}

interface HasuraPermissionSet {
  columns: string[];
  filter: any;
  check: any;
}

interface HasuraPermission {
  role: string;
  permission: HasuraPermissionSet;
}

interface HasuraTable {
  table: { schema: string; name: string };
  select_permissions?: HasuraPermission[];
  insert_permissions?: HasuraPermission[];
  update_permissions?: HasuraPermission[];
  delete_permissions?: HasuraPermission[];
}

const findOrCreateRolePermission = (arr: Array<RolePermission>, role: string): RolePermission => {
  let rp = arr.find((p) => p.role === role);

  if (!rp) {
    rp = { role, select_permissions: {}, insert_permissions: {}, update_permissions: {}, delete_permissions: {} };
    arr.push(rp);
  }

  return rp;
};

const tableName = (tbl: HasuraTable) => `${tbl.table.schema}.${tbl.table.name}`;

interface RoleTablePermission {
  [index: string]: HasuraPermissionSet;
}

interface RolePermission {
  role: string;
  select_permissions: RoleTablePermission;
  insert_permissions: RoleTablePermission;
  update_permissions: RoleTablePermission;
  delete_permissions: RoleTablePermission;
}

const roleReducer = (acc: Array<RolePermission>, tbl: HasuraTable): Array<RolePermission> => {
  (tbl.select_permissions || []).forEach(({ role, permission }) => {
    const rp = findOrCreateRolePermission(acc, role);

    rp.select_permissions[tableName(tbl)] = permission;
  });

  (tbl.insert_permissions || []).forEach(({ role, permission }) => {
    const rp = findOrCreateRolePermission(acc, role);

    rp.insert_permissions[tableName(tbl)] = permission;
  });

  (tbl.update_permissions || []).forEach(({ role, permission }) => {
    const rp = findOrCreateRolePermission(acc, role);

    rp.update_permissions[tableName(tbl)] = permission;
  });

  (tbl.delete_permissions || []).forEach(({ role, permission }) => {
    const rp = findOrCreateRolePermission(acc, role);

    rp.delete_permissions[tableName(tbl)] = permission;
  });

  return acc;
};

const run = async () => {
  const raw = await fs.readFile(schemaPath);
  const schema: HasuraSchema = yaml.load(raw.toString());
  const perms: Array<RolePermission> = schema.tables.reduce(roleReducer, []);

  console.log(JSON.stringify(perms, null, 2));
};

run();
