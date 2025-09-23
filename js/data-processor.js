// data-processor.js
class DataProcessor {
    constructor(columnMapping) {
        this.columnMapping = columnMapping;
    }

    async processFile(file) {
        if (file.name.endsWith('.parquet')) {
            return await this.processParquetFile(file);
        } else {
            return await this.processCSVFile(file);
        }
    }

    async processParquetFile(file) {
        if (typeof parquet === 'undefined' || !parquet.ParquetReader) {
            throw new Error('Parquet library not loaded. Please refresh the page.');
        }

        try {
            const buffer = await this.readFileAsArrayBuffer(file);
            const reader = await parquet.ParquetReader.openBuffer(buffer);
            const cursor = reader.getCursor();

            const data = [];
            const columnList = reader.getSchema().fieldList.map(f => f.name);

            if (!columnList.includes(this.columnMapping.fraudFlag)) {
                await reader.close();
                throw new Error(`File must contain '${this.columnMapping.fraudFlag}' column`);
            }

            let row;
            while ((row = await cursor.next())) {
                data.push(row);
            }

            await reader.close();

            const availableVariables = columnList.filter(
                col => ![this.columnMapping.fraudFlag, this.columnMapping.sessionId]
                    .includes(col.toLowerCase())
            );

            return {
                sampledData: data,
                availableVariables,
                totalRecords: data.length
            };
        } catch (error) {
            console.error('Parquet processing error:', error);
            throw new Error(`Parquet processing failed: ${error.message}`);
        }
    }

    async processCSVFile(file) {
        return new Promise((resolve, reject) => {
            const worker = new Worker('js/worker.js');

            worker.onmessage = function(e) {
                if (e.data.error) {
                    reject(new Error(e.data.error));
                    return;
                }

                if (!e.data.sampledData || !Array.isArray(e.data.sampledData)) {
                    reject(new Error('Invalid data format'));
                    return;
                }

                worker.terminate();
                resolve(e.data);
            };

            worker.onerror = (error) => {
                reject(new Error(`Worker error: ${error.message}`));
                worker.terminate();
            };

            worker.postMessage({
                file: file,
                columnMappings: this.columnMapping
            });
        });
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('File read error'));
            reader.onabort = () => reject(new Error('File read aborted'));

            reader.readAsArrayBuffer(file);
        });
    }
}