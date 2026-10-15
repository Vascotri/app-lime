import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  EVENT_CATEGORY_LABELS,
  TASK_CATEGORY_LABELS,
  SHOPPING_CATEGORY_LABELS,
  PERSON_LABELS,
  RECURRENCE_LABELS,
  EVENT_CATEGORY_BARS,
  PERSON_TONES,
} from './types'

/**
 * The allowed values for each column live in two places: a CHECK constraint in
 * supabase/schema.sql and a union type in lib/types.ts. Nothing in the compiler
 * ties them together, so a category added to one and forgotten in the other
 * fails only at runtime — as a 500 from Postgres when someone saves. These
 * tests make that drift a build failure instead.
 */

const root = join(__dirname, '..')

function readSql(...segments: string[]): string {
  return readFileSync(join(root, ...segments), 'utf8')
}

/** Allowed values per column, per table, parsed out of a CREATE TABLE block. */
function checkConstraints(sql: string): Record<string, Record<string, string[]>> {
  const tables: Record<string, Record<string, string[]>> = {}
  const tablePattern = /CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g

  for (const [, table, body] of sql.matchAll(tablePattern)) {
    tables[table] = {}
    const checkPattern = /CHECK \((\w+) IN \(([^)]*)\)\)/g
    for (const [, column, values] of body.matchAll(checkPattern)) {
      tables[table][column] = values
        .split(',')
        .map((value) => value.trim().replace(/^'|'$/g, ''))
    }
  }
  return tables
}

/** Allowed values per column, parsed out of ALTER TABLE ... ADD CONSTRAINT. */
function migrationConstraints(sql: string): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  const pattern =
    /ALTER TABLE (\w+) ADD CONSTRAINT \w+\s*\n?\s*CHECK \((\w+) IN \(([^)]*)\)\)/g

  for (const [, table, column, values] of sql.matchAll(pattern)) {
    result[`${table}.${column}`] = values
      .split(',')
      .map((value) => value.trim().replace(/^'|'$/g, ''))
  }
  return result
}

const schema = checkConstraints(readSql('supabase', 'schema.sql'))

const sorted = (values: string[]) => [...values].sort()

describe('schema.sql matches the TypeScript unions', () => {
  const cases: Array<[string, string, string[]]> = [
    ['events', 'category', Object.keys(EVENT_CATEGORY_LABELS)],
    ['events', 'attendees', Object.keys(PERSON_LABELS)],
    ['events', 'recurrence', Object.keys(RECURRENCE_LABELS)],
    ['tasks', 'category', Object.keys(TASK_CATEGORY_LABELS)],
    ['tasks', 'assigned_to', Object.keys(PERSON_LABELS)],
    ['shopping_items', 'category', Object.keys(SHOPPING_CATEGORY_LABELS)],
  ]

  for (const [table, column, expected] of cases) {
    it(`${table}.${column}`, () => {
      const actual = schema[table]?.[column]
      expect(actual, `no CHECK constraint found for ${table}.${column}`).toBeDefined()
      expect(sorted(actual!)).toEqual(sorted(expected))
    })
  }
})

describe('the migration lands on the same values as a fresh schema', () => {
  const migration = migrationConstraints(
    readSql('supabase', 'migrations', '001_add_categories_and_attendees.sql'),
  )

  // An existing project is migrated; a new one is created from schema.sql.
  // The two must agree or the app behaves differently against each.
  const columns = ['tasks.category', 'events.category', 'events.attendees']

  for (const key of columns) {
    it(key, () => {
      const [table, column] = key.split('.')
      expect(migration[key], `migration does not constrain ${key}`).toBeDefined()
      expect(sorted(migration[key])).toEqual(sorted(schema[table][column]))
    })
  }
})

describe('every value has presentation defined', () => {
  it('each event category has an accent bar colour', () => {
    expect(sorted(Object.keys(EVENT_CATEGORY_BARS))).toEqual(
      sorted(Object.keys(EVENT_CATEGORY_LABELS)),
    )
  })

  it('each person has a chip tone', () => {
    expect(sorted(Object.keys(PERSON_TONES))).toEqual(sorted(Object.keys(PERSON_LABELS)))
  })

  it('"Other" sorts last in every picker, so it never pushes a real option down', () => {
    for (const labels of [TASK_CATEGORY_LABELS, EVENT_CATEGORY_LABELS, SHOPPING_CATEGORY_LABELS]) {
      const keys = Object.keys(labels)
      expect(keys[keys.length - 1]).toBe('other')
    }
  })
})
