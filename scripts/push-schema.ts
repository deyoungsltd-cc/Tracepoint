// Push schema instruction
// The schema must be run in the Supabase SQL Editor with the service_role key.
// Go to: https://supabase.com/dashboard/project/bcgdwkhkstxneovbybmh/sql
// Copy/paste the contents of supabase-schema.sql

import * as fs from 'fs';
import * as path from 'path';

const schemaPath = path.join(__dirname, '..', 'supabase-schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');

console.log('=== Tracepoint Supabase Schema ===');
console.log('Run this in: Supabase Dashboard > SQL Editor');
console.log('URL: https://supabase.com/dashboard/project/bcgdwkhkstxneovbybmh/sql');
console.log('');
console.log(schema);
