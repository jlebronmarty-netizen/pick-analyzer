import expected from '../mlb-runtime-state/odds-budget-schema-contract.json' with {type:'json'}
import {sha256} from '../../../scripts/mlb-data-02r-r2f-stage-contracts.mjs'
export const oddsSchemaQuery=`SELECT jsonb_build_object(
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'grants',(SELECT jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'privilege',acl.privilege_type) ORDER BY COALESCE(r.rolname,'PUBLIC'),acl.privilege_type) FROM aclexplode(a.attacl) acl LEFT JOIN pg_roles r ON r.oid=acl.grantee)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.pick2_mlb_odds_operational_requests'::regclass AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('name',conname,'type',contype,'definition',pg_get_constraintdef(oid),'validated',convalidated) ORDER BY conname) FROM pg_constraint WHERE conrelid='public.pick2_mlb_odds_operational_requests'::regclass),
 'indexes',(SELECT jsonb_agg(indexdef ORDER BY indexname) FROM pg_indexes WHERE schemaname='public' AND tablename='pick2_mlb_odds_operational_requests'),
 'policies',(SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='pick2_mlb_odds_operational_requests'),
 'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.pick2_mlb_odds_operational_requests'::regclass),
 'bypass',(SELECT rolbypassrls FROM pg_roles WHERE rolname='service_role'),
 'grants',(SELECT jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'privilege',a.privilege_type) ORDER BY COALESCE(r.rolname,'PUBLIC'),a.privilege_type) FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE c.oid='public.pick2_mlb_odds_operational_requests'::regclass AND a.grantee<>c.relowner)) AS contract`
export async function assertOddsBudgetSchema(query) {
  const rows=await query(oddsSchemaQuery)
  if(rows.length!==1||sha256(rows[0].contract)!==sha256(expected))throw Error('R6_STATE:OPERATIONAL_BUDGET_SCHEMA')
}
