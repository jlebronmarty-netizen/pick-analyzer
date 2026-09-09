// Supabase-shaped adapter for an explicitly supplied in-memory PGlite instance.
// Test-only: no URL, credential, network transport or production client exists.
const identifier = value => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error('LOCAL_SQL_IDENTIFIER')
  return `"${value}"`
}

export function createPgliteClient(db) {
  class Query {
    constructor(table) { this.table = identifier(table); this.fields = '*'; this.filters = []; this.params = []; this.orders = []; this.take = null; this.skip = 0 }
    value(value) { this.params.push(value); return `$${this.params.length}` }
    select(fields = '*', options = {}) { this.fields = fields === '*' ? '*' : fields.split(',').map(identifier).join(','); this.count = options.count; return this }
    eq(field, value) { this.filters.push(`${identifier(field)} = ${this.value(value)}`); return this }
    is(field, value) { if (value !== null) throw new Error('LOCAL_IS_OPERATOR'); this.filters.push(`${identifier(field)} is null`); return this }
    in(field, values) { this.filters.push(values.length ? `${identifier(field)} in (${values.map(v => this.value(v)).join(',')})` : 'false'); return this }
    not(field, operator, value) { if (operator !== 'is' || value !== null) throw new Error('LOCAL_NOT_OPERATOR'); this.filters.push(`${identifier(field)} is not null`); return this }
    gte(field, value) { this.filters.push(`${identifier(field)} >= ${this.value(value)}`); return this }
    lt(field, value) { this.filters.push(`${identifier(field)} < ${this.value(value)}`); return this }
    or(expression) {
      const choices = expression.split(',').map(part => {
        const [field, operator, ...value] = part.split('.')
        if (operator !== 'eq') throw new Error('LOCAL_OR_OPERATOR')
        return `${identifier(field)} = ${this.value(value.join('.'))}`
      })
      this.filters.push(`(${choices.join(' or ')})`); return this
    }
    order(field, { ascending = true } = {}) { this.orders.push(`${identifier(field)} ${ascending ? 'asc' : 'desc'}`); return this }
    limit(count) { this.take = count; return this }
    range(start, end) { this.skip = start; this.take = end - start + 1; return this }
    insert(rows) { this.mutation = 'insert'; this.payloads = Array.isArray(rows) ? rows : [rows]; return this }
    update(row) { this.mutation = 'update'; this.payloads = [row]; return this }
    then(resolve, reject) { return this.execute().then(resolve, reject) }
    async execute() {
      try {
        const where = this.filters.length ? ` where ${this.filters.join(' and ')}` : ''
        if (this.mutation) {
          const data = []
          for (const row of this.payloads) {
            const fields = Object.keys(row).map(identifier).join(',')
            const params = [...this.params, JSON.stringify(row)]
            const record = `select ${fields} from jsonb_populate_record(null::${this.table}, $${params.length}::jsonb)`
            const sql = this.mutation === 'insert' ? `insert into ${this.table} (${fields}) ${record}` : `update ${this.table} set (${fields}) = (${record})${where}`
            const result = await db.query(`with changed as (${sql} returning ${this.fields}) select to_jsonb(changed) as row from changed`, params)
            data.push(...result.rows.map(r => r.row))
          }
          return { data, error: null }
        }
        const count = this.count ? Number((await db.query(`select count(*) as n from ${this.table}${where}`, this.params)).rows[0].n) : null
        const order = this.orders.length ? ` order by ${this.orders.join(',')}` : ''
        if (this.take !== null && (!Number.isInteger(this.take) || this.take < 0)) throw new Error('LOCAL_LIMIT')
        const limit = this.take === null ? '' : ` limit ${this.take} offset ${this.skip}`
        const result = await db.query(`select to_jsonb(q) as row from (select ${this.fields} from ${this.table}${where}${order}${limit}) q`, this.params)
        return { data: result.rows.map(r => r.row), count, error: null }
      } catch (error) { return { data: null, count: null, error: { code: error.code ?? 'LOCAL_ERROR', message: error.message } } }
    }
  }
  return { executionEnvironment: 'DISPOSABLE_PGLITE', from: table => new Query(table) }
}
