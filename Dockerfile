FROM node:26
COPY ./ /usr/src/app
WORKDIR /usr/src/app
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt -subj "/C=US/ST=New Sweden/L=Stockholm/O=.../OU=.../CN=.../emailAddress=..."
RUN npm i --verbose
# HTTP (redirects to HTTPS when the certificate above is present) and HTTPS
EXPOSE 3030 3031
# exec form, so node runs as PID 1 and receives stop signals directly
CMD ["node", "all-in-one.ts"]
