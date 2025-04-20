const axios = require('axios');

exports.handler = async (event) => {
  const queryData = {
    query: event.query,  // Query from the user
    parsedData: event.parsedData,  // Include parsed data from S3
  };

  const novaApiUrl = process.env.NOVA_API_URL; // Get API URL from environment

  try {
    const response = await axios.post(novaApiUrl, queryData);
    return { statusCode: 200, body: JSON.stringify(response.data) };
  } catch (error) {
    return { statusCode: 500, body: `Error: ${error.message}` };
  }
};
