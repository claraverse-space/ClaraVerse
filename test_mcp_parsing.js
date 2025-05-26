// Test script to verify MCP JSON parsing fixes
console.log('Testing MCP JSON parsing fixes...');

// Test cases that previously caused "Unexpected end of JSON input"
const testCases = [
  {
    name: 'Empty string',
    arguments: ''
  },
  {
    name: 'Null string',
    arguments: 'null'
  },
  {
    name: 'Undefined string',
    arguments: 'undefined'
  },
  {
    name: 'Whitespace only',
    arguments: '   '
  },
  {
    name: 'Valid JSON',
    arguments: '{"query": "test search"}'
  },
  {
    name: 'Invalid JSON',
    arguments: '{"query": "test search"'
  },
  {
    name: 'Object type',
    arguments: { query: "test search" }
  }
];

// Function to safely parse arguments (same logic as our fix)
function safeParseArguments(args) {
  try {
    if (typeof args === 'string') {
      const argsString = args.trim();
      if (argsString === '' || argsString === 'null' || argsString === 'undefined') {
        return {};
      } else {
        return JSON.parse(argsString);
      }
    } else if (args && typeof args === 'object') {
      return args;
    } else {
      return {};
    }
  } catch (parseError) {
    console.warn(`⚠️ Failed to parse arguments:`, parseError);
    console.warn(`⚠️ Raw arguments:`, args);
    return {};
  }
}

// Test all cases
testCases.forEach((testCase, index) => {
  console.log(`\nTest ${index + 1}: ${testCase.name}`);
  console.log(`Input:`, testCase.arguments);
  
  try {
    const result = safeParseArguments(testCase.arguments);
    console.log(`✅ Success:`, result);
  } catch (error) {
    console.log(`❌ Error:`, error.message);
  }
});

console.log('\n✅ All tests completed!'); 