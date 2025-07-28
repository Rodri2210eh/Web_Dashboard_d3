/**

 * Web Worker message handler

 * @param {MessageEvent} e - Message from main thread containing file and column mappings

 */

self.onmessage = async function(e) {

    const { file, columnMappings } = e.data;

 

    if (!file) {

        self.postMessage({ error: 'No file provided' });

        return;

    }

 

    try {

        const result = await processFile(file, columnMappings);

        self.postMessage(result);

    } catch (error) {

        console.error('Worker error:', error);

        self.postMessage({

            error: error.message || 'File processing error in worker'

        });

    }

};

 

/**

 * Process CSV file

 * @param {File} file - CSV file to process

 * @param {Object} columnMappings - Required column mappings

 * @returns {Promise} - Resolves with processed data or rejects with error

 */

async function processFile(file, columnMappings = {}) {

    return new Promise((resolve, reject) => {

        const fileReader = new FileReader();

 

        fileReader.onload = function(e) {

            try {

                const text = e.target.result;

                if (!text) throw new Error('Empty file');

 

                // Split lines and filter empty ones

                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

                if (lines.length < 2) throw new Error('CSV must contain headers and data');

 

                // Extract and clean headers

                const headers = lines[0].split(',').map(h => h.trim());

                if (headers.length === 0) throw new Error('No headers found');

 

                // Verify required columns

                const requiredColumns = [

                    columnMappings.fraudFlag || 'fraud_combined',

                    columnMappings.sessionId || 'sessionid'

                ];

 

                const missingColumns = requiredColumns.filter(col => !headers.includes(col));

                if (missingColumns.length > 0) {

                    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);

                }

 

                // Process all rows (no sampling)

                const data = [];

                for (let i = 1; i < lines.length; i++) {

                    if (!lines[i].trim()) continue;

 

                    const values = lines[i].split(',');

                    const row = {};

                    headers.forEach((header, index) => {

                        row[header] = values[index] || values[index].trim() || '';

                    });

 

                    // Validate fraud flag

                    if (isNaN(parseInt(row[columnMappings.fraudFlag]))) {

                        row[columnMappings.fraudFlag] = '0'; // Default value

                    }

 

                    data.push(row);

                }

 

                if (data.length === 0) throw new Error('No valid data found');

 

                // Determine available variables (excluding required columns)

                const availableVariables = headers.filter(header =>

                    !requiredColumns.includes(header)

                );

 

                resolve({

                    sampledData: data,

                    availableVariables,

                    totalRecords: data.length

                });

            } catch (error) {

                reject(error);

            }

        };

 

        fileReader.onerror = (event) => {

            reject(new Error(event.target.error || event.target.error.message || 'File read error'));

        };

 

        fileReader.onabort = () => {

            reject(new Error('File read aborted'));

        };

 

        fileReader.readAsText(file, 'UTF-8');

    });

}