const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src/app');
let modifiedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;
  
  content = content.replace(/export const runtime = 'edge';\r?\n/g, '');
  content = content.replace(/export const dynamic = 'force-dynamic';\r?\n/g, '');
  
  // Also clean up any double blank lines created by the removal
  content = content.replace(/\r?\n\r?\n\r?\n/g, '\n\n');

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    modifiedCount++;
    console.log(`Cleaned ${file}`);
  }
});

console.log(`Cleaned ${modifiedCount} files.`);
