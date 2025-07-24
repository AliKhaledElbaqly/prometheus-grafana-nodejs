FROM node:lts 
WORKDIR  /usr/src/app
COPY  . .     # copy everything from the current directory and put it in /usr/src/app
RUN npm install express prom-client
EXPOSE 3000
CMD ["node", "app.js"]