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

const failureRate = new Rate('check_failure_rate');

// Main function
export default function (authHeaderParams) {
    const response = http.get('http://localhost:8080/no-rate-limiter', authHeaderParams);

    // check() returns false if any of the specified conditions fail
    const checkRes = check(response, {
        'we expect all requests to pass': (r) => r.status === 200,
    });

    // We reverse the check() result since we want to count the failures
    failureRate.add(!checkRes);
}