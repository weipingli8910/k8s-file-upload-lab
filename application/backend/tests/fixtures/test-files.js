/**
 * Test file fixtures
 */
const fs = require('fs');
const path = require('path');

// Create test files directory if it doesn't exist
const testFilesDir = path.join(__dirname, '../fixtures/files');
if (!fs.existsSync(testFilesDir)) {
  fs.mkdirSync(testFilesDir, { recursive: true });
}

// Generate test files
function createTestFile(filename, size = 1024) {
  const filePath = path.join(testFilesDir, filename);
  const content = Buffer.alloc(size, 'A');
  fs.writeFileSync(filePath, content);
  return filePath;
}

// Clean up test files
function cleanupTestFiles() {
  if (fs.existsSync(testFilesDir)) {
    const files = fs.readdirSync(testFilesDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(testFilesDir, file));
    });
  }
}

// Pre-create common test files
const testFiles = {
  small: {
    name: 'test-small.txt',
    size: 1024, // 1KB
    path: createTestFile('test-small.txt', 1024)
  },
  medium: {
    name: 'test-medium.txt',
    size: 1024 * 100, // 100KB
    path: createTestFile('test-medium.txt', 1024 * 100)
  },
  large: {
    name: 'test-large.txt',
    size: 1024 * 1024 * 10, // 10MB
    path: createTestFile('test-large.txt', 1024 * 1024 * 10)
  }
};

module.exports = {
  testFiles,
  createTestFile,
  cleanupTestFiles,
  testFilesDir
};

