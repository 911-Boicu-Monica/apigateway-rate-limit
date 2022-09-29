import http from 'k6/http';
import {check} from 'k6';
import {Rate} from "k6/metrics";

export let options = {
    scenarios: {
        constant_request_rate: {
            executor: 'constant-arrival-rate',
            rate: 20,
            timeUnit: '1s',
            duration: '5s',
            preAllocatedVUs: 20,
            maxVUs: 20
        }
    }
};

const failureRate = new Rate('all_errors_failure_rate');
const errorRateHittingLimit = new Rate('429_failure_rate');

// Main function
export default function (authHeaderParams) {
    const response = http.get('http://localhost:8080/redis-rate-limiter', authHeaderParams);

    // check() returns false if any of the specified conditions fail
    const checkRes = check(response, {
        'we expect all requests to pass': (r) => r.status === 200,
    });

    const rateLimitCheck = check(response, {
        'we expect some requests to return 429': (r) => r.status === 429,
    });

    // We reverse the check() result since we want to count the failures
    failureRate.add(!checkRes);
    // Counting 429s
    errorRateHittingLimit.add(rateLimitCheck);
}