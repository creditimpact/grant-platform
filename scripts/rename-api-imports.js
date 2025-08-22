const fs = require('fs');
const path = require('path');
const glob = require('glob');
const recast = require('recast');
const babelParser = require('@babel/parser');

// Parse CLI args
const args = process.argv.slice(2);
let dryRun = false;
let rootDir = 'frontend/src';
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--dry') {
    dryRun = true;
  } else if (arg === '--root') {
    rootDir = args[i + 1] ? args[i + 1] : rootDir;
    i++;
  }
}

rootDir = path.resolve(rootDir);

// Glob pattern for target files
const pattern = '**/*.{ts,tsx,js,jsx}';
const files = glob.sync(pattern, { cwd: rootDir, absolute: true });

let scanned = 0;
let modified = 0;
const changedFiles = [];

files.forEach((file) => {
  scanned++;
  const source = fs.readFileSync(file, 'utf8');
  const ast = recast.parse(source, {
    parser: {
      parse(code) {
        return babelParser.parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        });
      },
    },
  });

  const importDeclarations = ast.program.body.filter(
    (n) => n.type === 'ImportDeclaration'
  );

  const hasApiClientImport = importDeclarations.some((d) =>
    typeof d.source.value === 'string' && d.source.value.endsWith('apiClient')
  );
  if (hasApiClientImport) {
    return; // skip file
  }

  let fileChanged = false;

  importDeclarations.forEach((decl) => {
    const val = decl.source.value;
    if (typeof val === 'string' && val.endsWith('/api')) {
      const newVal = val.replace(/\/api$/, '/apiClient');
      const quote =
        (decl.source.extra && decl.source.extra.raw && decl.source.extra.raw[0] === '\'')
          ? '\''
          : '"';
      decl.source.value = newVal;
      if (decl.source.extra) {
        decl.source.extra.raw = `${quote}${newVal}${quote}`;
      }
      fileChanged = true;
    }
  });

  if (fileChanged) {
    modified++;
    changedFiles.push(path.relative(process.cwd(), file));
    if (!dryRun) {
      const output = recast.print(ast).code;
      fs.writeFileSync(file, output, 'utf8');
    }
  }
});

console.log(`Scanned ${scanned} files.`);
console.log(`Modified ${modified} files.`);
if (changedFiles.length) {
  console.log('Changed files:');
  changedFiles.forEach((f) => console.log(` - ${f}`));
}
