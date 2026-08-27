import fs from 'node:fs'

const migrationPath = 'supabase/migrations/202608270001_pick2_reset_user_wager_count_only_rpc.sql'
const sql = fs.readFileSync(migrationPath, 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(sql.includes('create or replace function public.pick2_reset_inventory_user_wager_counts()'), 'must create the dedicated count-only function')
assert(sql.includes('returns table'), 'must return a table contract')
assert(sql.includes('user_wagers_count bigint'), 'must return user_wagers_count bigint')
assert(sql.includes('user_wager_legs_count bigint'), 'must return user_wager_legs_count bigint')
assert(sql.includes('security definer'), 'must use SECURITY DEFINER for aggregate count visibility')
assert(sql.includes('set search_path = public'), 'must set explicit safe search_path')
assert(sql.includes('select count(*) from public.user_wagers'), 'must count fixed user_wagers table')
assert(sql.includes('select count(*) from public.user_wager_legs'), 'must count fixed user_wager_legs table')
assert(!/\bexecute\b/i.test(sql.replace(/grant execute/gi, '').replace(/revoke all on function/gi, '')), 'must not use dynamic EXECUTE')
assert(!/\bdrop\s+table\b/i.test(sql), 'must not drop tables')
assert(!/\btruncate\b/i.test(sql), 'must not truncate')
assert(!/\bdelete\s+from\b/i.test(sql), 'must not delete data')
assert(!/\bupdate\s+public\./i.test(sql), 'must not update data')
assert(!/\balter\s+table\s+public\.user_wagers\s+disable\s+row\s+level\s+security\b/i.test(sql), 'must not disable user_wagers RLS')
assert(!/\balter\s+table\s+public\.user_wager_legs\s+disable\s+row\s+level\s+security\b/i.test(sql), 'must not disable user_wager_legs RLS')
assert(/revoke all on function public\.pick2_reset_inventory_user_wager_counts\(\) from public/i.test(sql), 'must revoke public access')
assert(/revoke all on function public\.pick2_reset_inventory_user_wager_counts\(\) from anon/i.test(sql), 'must revoke anon access')
assert(/revoke all on function public\.pick2_reset_inventory_user_wager_counts\(\) from authenticated/i.test(sql), 'must revoke authenticated access')
assert(/grant execute on function public\.pick2_reset_inventory_user_wager_counts\(\) to service_role/i.test(sql), 'must grant only service_role execution')

console.log(JSON.stringify({
  validator: 'pick-2-reset-01r2-user-wager-count-rpc-validate',
  status: 'PASS',
  migrationPath,
  functionName: 'public.pick2_reset_inventory_user_wager_counts',
  returnColumns: ['user_wagers_count', 'user_wager_legs_count'],
  securityDefinerCountOnlyContract: 'PASS',
  privacyContract: 'PASS',
  providerCalls: 0,
  dmlMutations: 0,
}, null, 2))
