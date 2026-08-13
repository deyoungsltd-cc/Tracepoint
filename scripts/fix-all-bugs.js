const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project';

// ============================================================
// FIX 1: Pipeline — use absolute URLs with origin prefix for reliability
// ============================================================
console.log('[FIX 1] Patching pipeline.ts — use absolute fetch URLs...');
const pipelinePath = path.join(ROOT, 'src/lib/api/pipeline.ts');
let pipeline = fs.readFileSync(pipelinePath, 'utf-8');

// Replace proxyNumVerify's relative fetch with absolute
pipeline = pipeline.replace(
  `const res = await fetch(\`/api/numverify?phone=\${encodeURIComponent(phone)}\`);`,
  `const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(\`\${baseUrl}/api/numverify?phone=\${encodeURIComponent(phone)}\`);`
);

// Replace proxySerperSearch's relative fetch with absolute
pipeline = pipeline.replace(
  `const res = await fetch('/api/serper', {`,
  `const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(\`\${baseUrl}/api/serper\`, {`
);

fs.writeFileSync(pipelinePath, pipeline);
console.log('  -> Done');

// ============================================================
// FIX 2: openai.ts — use absolute URL  
// ============================================================
console.log('[FIX 2] Patching openai.ts — use absolute fetch URL...');
const openaiPath = path.join(ROOT, 'src/lib/api/openai.ts');
let openai = fs.readFileSync(openaiPath, 'utf-8');

openai = openai.replace(
  `const res = await fetch('/api/ai', {`,
  `const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(\`\${baseUrl}/api/ai\`, {`
);

fs.writeFileSync(openaiPath, openai);
console.log('  -> Done');

// ============================================================
// FIX 3: abstractphone.ts — use absolute URL
// ============================================================
console.log('[FIX 3] Patching abstractphone.ts — use absolute fetch URL...');
const abstractPath = path.join(ROOT, 'src/lib/api/abstractphone.ts');
let abstract = fs.readFileSync(abstractPath, 'utf-8');

abstract = abstract.replace(
  `const res = await fetch('/api/abstractphone', {`,
  `const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(\`\${baseUrl}/api/abstractphone\`, {`
);

fs.writeFileSync(abstractPath, abstract);
console.log('  -> Done');

// ============================================================
// FIX 4: twilio.ts — use absolute URL
// ============================================================
console.log('[FIX 4] Patching twilio.ts — use absolute fetch URL...');
const twilioPath = path.join(ROOT, 'src/lib/api/twilio.ts');
let twilio = fs.readFileSync(twilioPath, 'utf-8');

twilio = twilio.replace(
  `const response = await fetch('/api/twilio', {`,
  `const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const response = await fetch(\`\${baseUrl}/api/twilio\`, {`
);

fs.writeFileSync(twilioPath, twilio);
console.log('  -> Done');

// ============================================================
// FIX 5: social-scraper.ts — use absolute URL
// ============================================================
console.log('[FIX 5] Patching social-scraper.ts — use absolute fetch URL...');
const socialPath = path.join(ROOT, 'src/lib/api/social-scraper.ts');
let social = fs.readFileSync(socialPath, 'utf-8');

social = social.replace(
  `const res = await fetch('/api/serper', {`,
  `const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(\`\${baseUrl}/api/serper\`, {`
);

fs.writeFileSync(socialPath, social);
console.log('  -> Done');

// ============================================================
// FIX 6: messaging-osint.ts — use absolute URL (3 occurrences)
// ============================================================
console.log('[FIX 6] Patching messaging-osint.ts — use absolute fetch URL...');
const msgPath = path.join(ROOT, 'src/lib/api/messaging-osint.ts');
let msg = fs.readFileSync(msgPath, 'utf-8');

let msgCount = 0;
msg = msg.replace(
  /const res = await fetch\('\/api\/serper', \{/g,
  () => {
    msgCount++;
    return `const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(\`\${baseUrl}/api/serper\`, {`;
  }
);

fs.writeFileSync(msgPath, msg);
console.log(`  -> Done (${msgCount} replacements)`);

// ============================================================
// FIX 7: numverify.ts — fix http:// to https://
// ============================================================
console.log('[FIX 7] Patching numverify.ts — fix http:// to https://...');
const numverifyPath = path.join(ROOT, 'src/lib/api/numverify.ts');
let numverify = fs.readFileSync(numverifyPath, 'utf-8');
numverify = numverify.replace('http://apilayer.net', 'https://apilayer.net');
fs.writeFileSync(numverifyPath, numverify);
console.log('  -> Done');

// ============================================================
// FIX 8: DB setup route — handle RLS 'new row violates row-level security policy' 
// and also accept anon key from user
// ============================================================
console.log('[FIX 8] Patching /api/setup/route.ts — better error handling...');
const setupPath = path.join(ROOT, 'src/app/api/setup/route.ts');
let setup = fs.readFileSync(setupPath, 'utf-8');

// Add handling for RLS policy denial (42501) and row-level security errors
const oldErrorHandling = `    // Other errors (RLS, permissions, etc.) — show as schema issue, not generic
    return NextResponse.json({
      configured: true,
      tablesExist: false,
      error: error.message,
      fix: 'run_schema',
    });`;

const newErrorHandling = `    // Row-level security policy error — table exists but anon can't read
    if (error.code === '42501' || error.message?.includes('row-level security') || error.message?.includes('policy') || error.message?.includes('permission denied')) {
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
      return NextResponse.json({
        configured: true,
        tablesExist: true, // Table EXISTS, just needs policy fix
        error: 'RLS policy blocks anonymous reads. Tables exist but policies need updating.',
        projectRef,
        fix: 'rls_policy',
        sqlUrl: \`https://supabase.com/dashboard/project/\${projectRef}/sql\`,
        instructions: [
          'Run in SQL Editor:',
          'CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);',
          'CREATE POLICY "Public read investigations" ON public.investigations FOR SELECT USING (true);',
        ],
      });
    }

    // Other errors (RLS, permissions, etc.) — show as schema issue, not generic
    return NextResponse.json({
      configured: true,
      tablesExist: false,
      error: error.message,
      fix: 'run_schema',
    });`;

setup = setup.replace(oldErrorHandling, newErrorHandling);
fs.writeFileSync(setupPath, setup);
console.log('  -> Done');

console.log('\n=== All fixes applied ===');
