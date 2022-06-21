FROM node:14.17-slim

## Install tools
RUN echo "**** install dependencies ****" && \
    apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    cron \
    curl \
    logrotate \
    zip && \
    # Cleanup
    apt-get autoremove -y && \
    apt-get autoclean -y && \
    rm -rf /tmp/* /var/lib/apt/lists/* && \
    echo "Done"

## Add logrotate cron job
ENV LOGS_DIR=/var/log/app
ENV LOGS_FILE=$LOGS_DIR/app.log
RUN mkdir -p $LOGS_DIR
RUN echo "**** configure logrotate and cron ****" && \
    echo $LOGS_FILE" {\n\
    missingok\n\
    notifempty\n\
    maxsize 5M\n\
    compress\n\
    copytruncate\n\
    create 700 root root\n\
    rotate 10\n}" > /etc/logrotate.conf && \
    echo "Done"

RUN chmod 0444 /etc/logrotate.conf
RUN echo "*/15 * * * *  root  /usr/sbin/logrotate /etc/logrotate.conf >> /var/log/cron.log 2>&1\n" > /etc/cron.d/logrotate

# Give execution rights on the cron job
RUN chmod +x /etc/cron.d/logrotate
RUN crontab /etc/cron.d/logrotate
# Must run the cron command on container startup (service cron start)

# Expose service port
EXPOSE 8080

# Install app (separate package.json from the rest of project files to
# make use of docker caching)
RUN mkdir -p /app
WORKDIR /app
COPY package*.json ./
RUN echo "**** install node app ****" && \
    npm install && \
    echo "Done"

# Copy app files
COPY src .

# Scripts permissions
COPY docker-scripts /docker-scripts
RUN chmod +x -R /docker-scripts

# Define healthcheck command
HEALTHCHECK CMD /docker-scripts/healthcheck.sh

# Set entrypoint to launch service
ENTRYPOINT /docker-scripts/launch.sh
