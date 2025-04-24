const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const csvParser = require('csv-parser');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
  const { bucket, key } = event.Records[0].s3;
  const fileType = key.split('.').pop().toLowerCase();  // Get the file extension
  
  // Get file metadata (size, timestamp, etc.)
  const fileMetadata = await getFileMetadata(bucket.name, key);
  const { fileSize, uploadTimestamp, user } = fileMetadata;

  try {
    // 1. Check if the file has been processed already
    const existingItem = await checkIfProcessed(key);
    if (existingItem) {
      console.log(`Skipping file ${key} as it has already been processed.`);
      return;
    }

    // 2. Parse the file based on its extension
    let parsedData;
    if (fileType === 'docx') {
      parsedData = await parseDocx(file.Body);
    } else if (fileType === 'pdf') {
      parsedData = await parsePdf(file.Body);
    } else if (fileType === 'csv') {
      parsedData = await parseCsv(file.Body);
    } else if (fileType === 'txt') {
      parsedData = await parseTxt(file.Body);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    // 3. Store parsed data and metadata in DynamoDB
    await storeFileMetadata(key, fileSize, user, uploadTimestamp, "Processing");
    await storeParsedDataInDynamoDB(key, parsedData);

    // 4. Update status to "Completed"
    await updateFileStatus(key, "Completed");

    console.log('Data successfully stored in DynamoDB!');
  } catch (error) {
    console.error('Error processing file:', error);
    // Update status to "Error"
    await updateFileStatus(key, "Error");
    throw error;
  }
};

// Helper functions

// Get file metadata (e.g., size, timestamp, user)
async function getFileMetadata(bucketName, key) {
  const file = await s3.headObject({ Bucket: bucketName, Key: key }).promise();
  return {
    fileSize: file.ContentLength,
    uploadTimestamp: file.LastModified,
    user: file.Metadata.user || 'Unknown', // Assuming user info is stored as metadata
  };
}

// Check if the file has already been processed
async function checkIfProcessed(fileKey) {
  const params = {
    TableName: process.env.DYNAMO_TABLE_NAME,
    Key: { documentId: fileKey },
  };

  const result = await dynamodb.get(params).promise();
  return result.Item;  // If exists, return the item
}

// Store parsed data and metadata in DynamoDB
async function storeParsedDataInDynamoDB(fileKey, parsedData) {
    const fileMetadata = {
      documentId: fileKey,  // Use the S3 file name as the documentId
      fileSize: fileSize,  // Get the file size from the S3 object metadata
      uploadedBy: "user",  // Track the user from the request, for example
      uploadTimestamp: new Date().toISOString(),
      fileStatus: "Completed",  // Default status can be "Completed" or "Processing"
    };
  
    // First, store metadata in the table
    const metadataParams = {
      TableName: process.env.DYNAMO_TABLE_NAME,
      Item: fileMetadata,
    };
  
    await dynamodb.put(metadataParams).promise();
  
    // Then, store parsed data
    const promises = parsedData.sections.map(async (section) => {
        const item = {
            tenantId: 'tenant123',  // Add tenantId to specify the customer
            documentId: fileKey,    // Unique ID for the document (e.g., S3 file name)
            sectionId: `section_${section.id}`, // Unique section ID
            heading: section.heading,
            content: section.content,
            metadata: {
              documentType: "Policy",
              createdOn: new Date().toISOString(),
              fileSize: fileSize,  // File size (from S3 metadata)
              uploadedBy: uploadedBy,  // User who uploaded the file (optional)
              fileStatus: "Completed",
            },
          };          
  
      const params = {
        TableName: process.env.DYNAMO_TABLE_NAME,
        Item: item,
      };
  
      await dynamodb.put(params).promise();
    });
  
    await Promise.all(promises);
  }
  
// Store file metadata in DynamoDB (status, file size, user, etc.)
async function storeFileMetadata(fileKey, fileSize, user, uploadTimestamp, status) {
  const params = {
    TableName: process.env.DYNAMO_TABLE_NAME,
    Item: {
      documentId: fileKey,
      status: status,
      fileSize: fileSize,
      user: user,
      uploadTimestamp: uploadTimestamp,
      createdOn: new Date().toISOString(),
    },
  };

  await dynamodb.put(params).promise();
}

// Update file status (Processing, Completed, Error)
async function updateFileStatus(fileKey, status) {
  const params = {
    TableName: process.env.DYNAMO_TABLE_NAME,
    Key: { documentId: fileKey },
    UpdateExpression: "set #status = :status",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":status": status },
  };

  await dynamodb.update(params).promise();
}

// File Parsers

// DOCX Parser using Mammoth
async function parseDocx(fileContent) {
  const result = await mammoth.extractRawText({ buffer: fileContent });
  const sections = result.value.split('\n\n').map((section, index) => ({
    id: index + 1,
    heading: `Section ${index + 1}`,
    content: section,
  }));
  return { sections };
}

// PDF Parser using pdf-parse
async function parsePdf(fileContent) {
  const pdfData = await pdfParse(fileContent);
  const sections = pdfData.text.split('\n\n').map((section, index) => ({
    id: index + 1,
    heading: `Section ${index + 1}`,
    content: section,
  }));
  return { sections };
}

// CSV Parser using csv-parser
async function parseCsv(fileContent) {
  const sections = [];
  const csvStream = fileContent.pipe(csvParser());
  const promise = new Promise((resolve, reject) => {
    const sectionBuffer = [];
    csvStream.on('data', (row) => sectionBuffer.push(row));
    csvStream.on('end', () => {
      sectionBuffer.forEach((row, i) => {
        sections.push({
          id: i + 1,
          heading: `Row ${i + 1}`,
          content: JSON.stringify(row),
        });
      });
      resolve({ sections });
    });
    csvStream.on('error', reject);
  });
  await promise;
  return { sections };
}

// Text Parser for TXT files
async function parseTxt(fileContent) {
  const content = fileContent.toString();
  const sections = content.split('\n\n').map((section, index) => ({
    id: index + 1,
    heading: `Section ${index + 1}`,
    content: section,
  }));
  return { sections };
}
