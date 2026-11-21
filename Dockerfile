FROM node:26
ENV NODE_ENV=production
COPY ./ /usr/src/app
WORKDIR /usr/src/app
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt -subj "/C=US/ST=New Sweden/L=Stockholm/O=.../OU=.../CN=.../emailAddress=..."
# the runtime dependencies only, as package-lock.json gives them (the TypeScript sources run through Node's type stripping)
RUN npm ci --omit=dev
# HTTP (redirects to HTTPS when the certificate above is present) and HTTPS
EXPOSE 3030 3031
# ready once the service list registry has been read, and not ready while shutting down (/healthz). The certificate is
# self-signed, so it is not verified
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD ["node", "-e", "require('https').get({host:'127.0.0.1',port:3031,path:'/healthz',rejectUnauthorized:false},(r)=>process.exit(r.statusCode==200?0:1)).on('error',()=>process.exit(1))"]
# exec form, so node runs as PID 1 and receives stop signals directly (SIGTERM shuts down gracefully)
CMD ["node", "all-in-one.ts"]
