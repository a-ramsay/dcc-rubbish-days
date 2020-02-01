import app from './src/app';
import serverless from 'serverless-http';

module.exports.express = serverless(app);