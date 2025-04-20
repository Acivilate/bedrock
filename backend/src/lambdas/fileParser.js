const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { parseCsv, parsePdf, parseDocx } = require('./fileParsers'); // Helper functions to parse files

exports.handler = async (event) => {
  const bucketName = event.Records[0].s3.bucket.name;
  const fileName = event.Records[0].s3.object.key;
  
  const fileParams = {
    Bucket: bucketName,
    Key: fileName,
  };

  try {
    // Retrieve the file from S3
    const file = await s3.getObject(fileParams).promise();
    let parsedData;
    
    // Check the file type and parse accordingly
    if (fileName.endsWith('.csv')) {
      parsedData = await parseCsv(file.Body.toString());
    } else if (fileName.endsWith('.pdf')) {
      parsedData = await parsePdf(file.Body);
    } else if (fileName.endsWith('.docx')) {
      parsedData = await parseDocx(file.Body);
    } else {
      throw new Error('Unsupported file type');
    }

    // Store parsed data in DynamoDB
    const dbParams = {
      TableName: process.env.DYNAMO_TABLE_NAME, // Replace with your table name
      Item: parsedData,
    };

    await dynamodb.put(dbParams).promise();

    console.log('File processed and data stored:', parsedData);
  } catch (error) {
    console.error('Error processing file:', error);
    throw error;
  }
};
