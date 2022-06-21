#!/bin/bash

# perform curl operation
CURL_RETURN_CODE=0
CURL_OUTPUT=`curl -f http://localhost:8080 2> /dev/null` || CURL_RETURN_CODE=$?
if [ ${CURL_RETURN_CODE} -ne 0 ]; then
    if [ ! -f .unhealthy ]; then
        FAILING_STRIKE=1
    else
        FAILING_STRIKE=$(($(cat .unhealthy) + 1))
    fi
    if [ $FAILING_STRIKE == 3 ]; then
        # Notify
        echo "Healthcheck failed with return code '${CURL_RETURN_CODE}'" 2>&1 | tee -a $LOGS_FILE
        touch .unhealthy
        ./slack-notify.sh 'unhealthy'
    else
        echo "Healthcheck failed with return code '${CURL_RETURN_CODE}'"
    fi
    echo $FAILING_STRIKE > .unhealthy
    exit 1
else
    # Successfull healthcheck
    if [ -f .unhealthy ]; then
        echo "Health recovered" 2>&1 | tee -a $LOGS_FILE
        rm -rf .unhealthy
        ./slack-notify.sh 'healthy'
    fi
    exit 0
fi
