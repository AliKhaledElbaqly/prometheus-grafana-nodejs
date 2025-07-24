const express = require('express');                     // web framework to create a lightweigh server 
const client = require('prom-client');                // prometheus library to collect metrcis 

const app = express();
const port = 3000;                                                     // open port 3000

// Create a Registry to register the metrics
const register = new client.Registry();                                    

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'nodejs_system_app'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });                          // Memory – Cpu – event loop lag – gc state 

// Define a custom metric for total HTTP requests to the root path
const rootHttpRequestCounter = new client.Counter({
  name: 'http_requests_root_total',
  help: 'Total number of HTTP requests to the root path',
});

// Register the custom metric
register.registerMetric(rootHttpRequestCounter);

// Middleware to count every request to the root path
app.use((req, res, next) => {
  if (req.path === '/') {
    rootHttpRequestCounter.inc();
  }
  next();
});

// Define a route for Prometheus to scrape
app.get('/metrics', async (req, res) => {                        // open the endpoint /metrics that store information
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Define the root route
app.get('/', (req, res) => {
  res.send('Hello From Node.js app Test');
});

// Start the server
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});