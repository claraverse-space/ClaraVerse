import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeJsonToCsv = async (context: NodeExecutionContext): Promise<string> => {
  const { node, inputs, updateNodeOutput } = context;
  
  try {
    const input = inputs.text || '';
    let jsonData: any;
    
    try {
      jsonData = typeof input === 'string' ? JSON.parse(input) : input;
    } catch (error) {
      throw new Error('Invalid JSON input');
    }

    // Handle nested JSON structure - improved to handle more cases
    if (!Array.isArray(jsonData) && typeof jsonData === 'object') {
      // Case 1: Direct object with a single array property (e.g., {"cars": [...]}})
      const keys = Object.keys(jsonData);
      if (keys.length === 1 && Array.isArray(jsonData[keys[0]])) {
        console.log(`Extracting array from property: ${keys[0]}`);
        jsonData = jsonData[keys[0]];
      }
      // Case 2: Direct array of objects - keep as is
      else if (Array.isArray(jsonData)) {
        // Already an array, no change needed
      }
      // Case 3: Single object - wrap in array
      else if (typeof jsonData === 'object' && !Array.isArray(jsonData)) {
        // If it's a single object (not an array), wrap it in an array
        jsonData = [jsonData];
      }
    }

    // Check if the data is in column format (each key has an array of values)
    const isColumnFormat = Object.values(jsonData).some(value => Array.isArray(value));
    
    if (isColumnFormat) {
      // Handle column-oriented format (arrays of values)
      return processColumnOrientedJson(jsonData, node, updateNodeOutput);
    } else {
      // Handle row-oriented format (array of objects or single object)
      const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
      if (dataArray.length === 0) {
        throw new Error('Empty JSON array');
      }

      // Get headers from first object
      const headers = Object.keys(dataArray[0]);
      
      // Convert to CSV
      const csv = [
        headers.join(','), // Header row
        ...dataArray.map(row => 
          headers.map(header => {
            const value = row[header];
            // Handle values that need quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? '';
          }).join(',')
        )
      ].join('\n');

      // Store CSV in node config for download access
      if (!node.data.config) node.data.config = {};
      node.data.config.csvOutput = csv;
      
      // Log the CSV output for debugging
      console.log("Generated CSV:", csv);

      // Trigger download
      downloadCsv(csv);
      
      if (updateNodeOutput) {
        updateNodeOutput(node.id, csv);
      }

      return csv;
    }
  } catch (error) {
    const errorMsg = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.error("JSON to CSV Error:", errorMsg);
    if (updateNodeOutput) {
      updateNodeOutput(node.id, errorMsg);
    }
    return errorMsg;
  }
};

// Helper function to process column-oriented JSON (where fields are arrays)
const processColumnOrientedJson = (jsonData: any, node: any, updateNodeOutput?: Function): string => {
  // Get all the column names (keys in the JSON)
  const columns = Object.keys(jsonData);
  
  if (columns.length === 0) {
    throw new Error('No columns found in JSON');
  }
  
  // Find the maximum array length across all columns
  const maxRowCount = columns.reduce((max, col) => {
    const arr = jsonData[col];
    return Array.isArray(arr) ? Math.max(max, arr.length) : max;
  }, 0);
  
  if (maxRowCount === 0) {
    throw new Error('No data found in JSON arrays');
  }
  
  // Create CSV header row
  const csvRows = [columns.join(',')];
  
  // For each row, grab the corresponding item from each column's array
  for (let rowIndex = 0; rowIndex < maxRowCount; rowIndex++) {
    const rowValues = columns.map(column => {
      const columnData = jsonData[column];
      // Get value if it exists for this row index, otherwise empty string
      const value = Array.isArray(columnData) && rowIndex < columnData.length 
        ? columnData[rowIndex] 
        : '';
      
      // Handle values that need quotes (contain commas or quotes)
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    });
    
    csvRows.push(rowValues.join(','));
  }
  
  const csv = csvRows.join('\n');
  
  // Store CSV in node config for download access
  if (!node.data.config) node.data.config = {};
  node.data.config.csvOutput = csv;
  
  // Trigger download
  downloadCsv(csv);
  
  if (updateNodeOutput) {
    updateNodeOutput(node.id, csv);
  }
  
  return csv;
};

// Helper function to download CSV
const downloadCsv = (csv: string) => {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `converted_${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

registerNodeExecutor('jsonToCsvNode', {
  execute: executeJsonToCsv
});
