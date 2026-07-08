const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.next' && f !== 'dist' && f !== 'build') {
        walkDir(dirPath, callback);
      }
    } else {
      if (dirPath.endsWith('.ts') || dirPath.endsWith('.tsx') || dirPath.endsWith('.js')) {
        callback(dirPath);
      }
    }
  });
}

function removeConsoleLogs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Simple regex to replace single-line console statements
  let newContent = content.replace(/^[ \t]*console\.(log|warn|error)\(.*?\);?[\r\n]+/gm, '');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Cleaned: ${filePath}`);
  }
}

console.log('Starting cleanup...');
walkDir(path.join(__dirname, 'frontend', 'src'), removeConsoleLogs);
walkDir(path.join(__dirname, 'backend', 'src'), removeConsoleLogs);
console.log('Done.');
