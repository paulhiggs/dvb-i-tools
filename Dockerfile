FROM node:16
COPY ./ /usr/src/app
WORKDIR /usr/src/app
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt -subj "/C=US/ST=New Sweden/L=Stockholm/O=.../OU=.../CN=.../emailAddress=..."
RUN npm i --verbose
CMD ["/bin/bash", "-c", "node all-in-one"]