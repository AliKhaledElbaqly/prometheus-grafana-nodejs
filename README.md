# 📊📈 Node.js Application Monitoring with Prometheus, Grafana & Kubernetes

### A complete DevOps pipeline for **monitoring a Node.js application** using **Prometheus**, **Grafana**, and **Kubernetes (kubeadm or EKS)**.

---

## 🧰 Tech Stack

| Tool           | Purpose                                  |
|----------------|-------------------------------------------|
| 🟢 Node.js     | Application backend                       |
| 🐳 Docker      | Containerization                          |
| ☸️ Kubernetes  | Container orchestration                   |
| 📈 Prometheus  | Metrics collection & alerting             |
| 📊 Grafana     | Data visualization                        |
| 🔔 Alertmanager| Notification routing (Slack integration)  |

---

## 📋 Project Overview

This project monitors a custom Node.js app and provides:

- Real-time metrics (CPU, memory, request rate)
- Alerting rules for high traffic
- Slack alerts via Alertmanager
- Grafana dashboards for visualization

---

## 🛠️ Requirements

```bash
- Kubernetes cluster (kubeadm or EKS)
- Docker
- Helm
- Node.js
- Prometheus
- Grafana
```


# 🧱 Step-by-Step Deployment

## 1. 🧑‍💻 Build Node.js App with Metrics
>#### File: `index.js`

```js
const express = require('express');
const client = require('prom-client');

const app = express();
const port = 3000;

const register = new client.Registry();
register.setDefaultLabels({ app: 'nodejs_system_app' });
client.collectDefaultMetrics({ register });

const rootHttpRequestCounter = new client.Counter({
  name: 'http_requests_root_total',
  help: 'Total number of HTTP requests to the root path',
});
register.registerMetric(rootHttpRequestCounter);

app.use((req, res, next) => {
  if (req.path === '/') rootHttpRequestCounter.inc();
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/', (req, res) => {
  res.send('Hello From Node.js app Test');
});

app.listen(port, () => {
  console.log(`App running at http://localhost:${port}`);
});
```
>###### `/metrics` endpoint so Prometheus can scrape custom metrics like HTTP request count, memory usage, etc. This step embeds monitoring logic in your app.

## 2. 🐳 Create Docker Image
>#### File: `Dockerfile`

```dockerfile
FROM node:lts
WORKDIR /usr/src/app
COPY . .
RUN npm install express prom-client
EXPOSE 3000
CMD ["node", "index.js"]
```
>###### `Docker` packages the app in a lightweight container that can run consistently across environments. It's also required for Kubernetes deployment in the next steps.

>#### Build and push:

```bash
docker build -t nodejs-app-prom .
docker tag nodejs-app-prom:latest your-dockerhub-user/nodejs-app-prom:v1
docker push your-dockerhub-user/nodejs-app-prom:v1
```
## 3. ☸️ Kubernetes Deployment
>#### File: `nodejs-app.yaml`

```yaml 
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nodejs-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nodejs
  template:
    metadata:
      labels:
        app: nodejs
    spec:
      containers:
        - name: nodejs
          image: your-dockerhub-user/nodejs-app-prom:v1
          ports:
            - containerPort: 3000
```
>#### File: `nodejs-svc.yaml`
```yaml
apiVersion: v1
kind: Service
metadata:
  name: nodejs-svc
  labels:
    app: nodejs
  annotations:
    prometheus.io/scrape: "true"
spec:
  type: NodePort
  selector:
    app: nodejs
  ports:
    - port: 3000
      targetPort: 3000
      nodePort: 31557
```
>#### Apply with: 
```bash
kubectl apply -f nodejs-app.yaml
kubectl apply -f nodejs-svc.yaml
```
>###### `Service` required to expose your app on Kubernetes so Prometheus and external users can access it. Annotations here enable Prometheus to scrape it.

## 4. 📡 Prometheus ServiceMonitor

>#### File: `nodejs-monitor.yaml`

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: nodejs-monitor
  namespace: monitoring
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app: nodejs
  namespaceSelector:
    matchNames:
      - default
  endpoints:
    - port: http-nodejs-app
      path: /metrics
```
```bash 
kubectl apply -f nodejs-monitor.yaml
```
>###### Prometheus need it to know about your Node.js app's metrics. The `ServiceMonitor` links your service to the Prometheus stack.

## 5. 🔔 Create Prometheus Alert

>#### File: `nodejs-rule.yaml`

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: nodejs-alerts
  namespace: monitoring
  labels:
    app: kube-prometheus-stack
    release: prometheus
spec:
  groups:
    - name: nodejs.alert
      rules:
        - alert: HighRequestRate_NodeJS
          expr: rate(http_requests_root_total[5m]) > 10
          for: 0m
          labels:
            app: nodejs
          annotations:
            summary: "High request rate detected in Node.js application"
            description: "High traffic load detected ({{ $value }})"
```
```bash
kubectl apply -f nodejs-rule.yaml
```
>###### `Rules` & `Alerts` let you react to traffic spikes, errors, or slowdowns in real-time. crucial for system reliability and uptime.

## 6. 💬 Slack Notification via Alertmanager
##### - Create secret 
##### - Apply AlertmanagerConfig

```yaml 
apiVersion: monitoring.coreos.com/v1alpha1
kind: AlertmanagerConfig
metadata:
  name: nodejs-alert-manager
  namespace: monitoring
spec:
  route:
    receiver: 'nodejs-slack'
    repeatInterval: 30m
    routes:
      - matchers:
          - name: alert-https
            value: HighRequestRate_NodeJS
        repeatInterval: 10m
  receivers:
    - name: 'nodejs-slack'
      slackConfigs:
        - apiURL:
            key: webhook
            name: slack-secret
          channel: '#https_requests'
          sendResolved: true
```
```bash
kubectl apply -f nodejs-alert-manager.yaml
```
>###### Pormetheus allows us to Integration with other softwares like Slack or other channels to let your team gets alerted instantly when something goes wrong.

## 7. 📊 View Dashboard in Grafana

>### 📌 Login to Grafana at:
>#### `http://<node-ip>:<grafana-nodeport>`

#### Default login:

```vbnet
Username: admin
Password: prom-operator
```
## 📈 Example Metrics Used to Graph:
```prometheus
rate(http_requests_root_total[1m])
container_cpu_usage_seconds_total
container_memory_usage_bytes
```
>  We use garfana to visualize raw metrics and turn it into intuitive charts. You can explore trends, resource usage, and custom KPIs.

## 🖼️ Dashboard Screenshot 


### 8. 🧪 Stress Testing Script

```bash
#!/bin/bash
send_requests() {
    while true; do
        curl -sS http://<node-ip>:31557/ > /dev/null
        echo "Request sent"
        sleep 0.0667
    done
}
for ((i=1; i<=15; i++)); do
    send_requests &
done
wait
```
```bash
chmod +x forcerequests.sh
./forcerequests.sh
```

>### Now Watch Prometheus alerts and Grafana graphs in real time 🚨

## 🔚 Conclusion

#### With this setup, you've created a production-style monitoring pipeline:
##### - ✅ Custom app metrics
##### - ✅ Kubernetes ServiceMonitor integration
##### - ✅ Alerting with Slack
##### - ✅ Real-time visualization with Grafana

## 📌 Screenshots & Visuals
![Alerts](https://res.cloudinary.com/dmt3wghiv/image/upload/v1753325970/Screenshot_from_2025-07-24_04-01-06_dn7bra.png)

![Network graph](https://res.cloudinary.com/dmt3wghiv/image/upload/v1753325970/Screenshot_from_2025-07-24_04-04-47_rooeue.png)

![Network graph](https://res.cloudinary.com/dmt3wghiv/image/upload/v1753325970/Screenshot_from_2025-07-24_04-02-02_rnwrec.png)

![Network graph](https://res.cloudinary.com/dmt3wghiv/image/upload/v1753325970/Screenshot_from_2025-07-24_04-00-49_ukodnp.png)

![ns resources](https://res.cloudinary.com/dmt3wghiv/image/upload/v1753325969/Screenshot_from_2025-07-24_04-02-44_ampbzu.png)

![ns resources](https://res.cloudinary.com/dmt3wghiv/image/upload/v1753325969/Screenshot_from_2025-07-24_04-01-47_inhkqy.png)

![stop the stress ](https://res.cloudinary.com/dmt3wghiv/image/upload/v1753325969/Screenshot_from_2025-07-24_04-08-09_ukjfky.png)
