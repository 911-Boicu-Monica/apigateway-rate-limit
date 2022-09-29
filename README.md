## Rate limiting with Spring API Gateway

The purpose of this repository is to demo how rate limiting can be implemented using Spring API Gateway. 

Besides the Spring tech stack:
- [Maven](https://maven.apache.org/) is being used for managing dependencies.
- [Redis](https://redis.io/) to store the data needed by the rate limiting algorithm.
- [K6](https://k6.io) for load testing.
- [Docker](https://www.docker.com) to easily set up the prerequisites.

### The API Gateway
It is a pattern describing a service that provides a single entry point for a group of microservices.

The API gateway sits between the client apps and the microservices, acting as a reverse proxy - routes requests from clients to services.

ref: [API Gateway Pattern](https://microservices.io/patterns/apigateway.html)

### Spring API Gateway
In order to create the [API Gateway using Spring](https://cloud.spring.io/spring-cloud-gateway/reference/html/), the **spring-cloud-starter-gateway** starter can be used.

e.g.
```
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
</dependency>
```

As with any spring boot project, the main application class should be annotated with **@SpringBootApplication** and 
the main method should contain the code to bootstrap and launch it.

```
@SpringBootApplication
public class ApiGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }
}
```

When the started is included, the following property can be used to enable/disable the api gateway:
```
spring.cloud.gateway.enabled: false
```

**Note:** It is recommended to go through the [Glossary](https://cloud.spring.io/spring-cloud-gateway/reference/html/#glossary) and [How It Works](https://cloud.spring.io/spring-cloud-gateway/reference/html/#gateway-how-it-works) sections of the documentation before moving forward with the routes configuration.

### No rate limit route
By default, no rate limiting is applied to any route defined in the configuration file (application.yml file).

Config example:
```
spring:
  cloud:
    gateway:
      routes:
        - id: demo-no-rate-limiter
          uri: https://httpbin.org/get
          predicates:
            - Path=/no-rate-limiter/**
          filters:
            - RewritePath=/no-rate-limiter(?<segment>.*), /${segment}
```

### Rate limited route with Redis
Rate limiting can be applied by configuring the [RequestRateLimiter](https://cloud.spring.io/spring-cloud-gateway/reference/html/#the-requestratelimiter-gatewayfilter-factory) filter to desired route - 429 HTTP status is returned when request is not allowed to proceed.

Optionally the key resolver can be configured (by default uses the **PrincipalNameKeyResolver**) referencing the bean with SpEL in the application.yml file (e.g.: **key-resolver: "#{@routeIdKeyResolver}"**).

Key Resolver example that uses the route id:
```java
    @Bean
    public KeyResolver routeIdKeyResolver() {
        return exchange -> Mono.fromSupplier(() -> {
            Route route = exchange.getAttribute(ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR);
            return route.getId();
        });
    }
```

To consider rates calculated across all the api gateway instances, the data used by the rating algorithm needs to be stored in a centralized data store.
An available [implementation](https://cloud.spring.io/spring-cloud-gateway/reference/html/#the-redis-ratelimiter) is the token bucket algorithm with Redis for storage.

Steps to integrate redis rate limiting:
- Add Redis maven dependency:
```
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis-reactive</artifactId>
</dependency>
```

- Add Redis configuration in the application.yml file:
```
spring:
  redis:
    host: localhost
    port: 6379
```

Config example for rate limited route with Redis: 
```
spring:
  cloud:
    gateway:
      routes:
        - id: demo-redis-rate-limiter
          uri: https://httpbin.org/get
          predicates:
            - Path=/redis-rate-limiter/**
          filters:
            - RewritePath=/redis-rate-limiter(?<segment>.*), /${segment}
            - name: RequestRateLimiter
              args:
                key-resolver: "#{@routeIdKeyResolver}"
                redis-rate-limiter.replenishRate: 10
                redis-rate-limiter.burstCapacity: 10
                redis-rate-limiter.requestedTokens: 1
```

### Prerequisite:
- Build the project with Maven:
    ```
        mvn clean install
    ```

- K6 must be installed to run the load tests - steps from the [installation](https://k6.io/docs/getting-started/installation/) guide can be followed
- docker-compose.yml file is provided in the demo project, containing Redis and K6 prerequisites. Navigate to the source folder and run:
  ```
    docker-compose up -d
  ```

### Load tests result samples
K6 load tests can be executed running the following command:
```
    k6 run file_name.js
```

No rate limit result:
```java
k6 run no_rate_limiting_demo.js 

          /\      |‾‾| /‾‾/   /‾‾/   
     /\  /  \     |  |/  /   /  /    
    /  \/    \    |     (   /   ‾‾\  
   /          \   |  |\  \ |  (‾)  | 
  / __________ \  |__| \__\ \_____/ .io

  execution: local
     script: no_rate_limiting_demo.js
     output: -

  scenarios: (100.00%) 1 scenario, 20 max VUs, 35s max duration (incl. graceful stop):
           * constant_request_rate: 20.00 iterations/s for 5s (maxVUs: 20, gracefulStop: 30s)


running (05.1s), 00/20 VUs, 101 complete and 0 interrupted iterations
constant_request_rate ✓ [======================================] 00/20 VUs  5s  20.00 iters/s

     ✓ we expect all requests to pass

     check_failure_rate.............: 0.00%   ✓ 0         ✗ 101 
     checks.........................: 100.00% ✓ 101       ✗ 0   
     data_received..................: 991 kB  193 kB/s
     data_sent......................: 9.6 kB  1.9 kB/s
     http_req_blocked...............: avg=96.48µs  min=3µs      med=7µs      max=1.58ms  p(90)=385µs    p(95)=409µs   
     http_req_connecting............: avg=62.51µs  min=0s       med=0s       max=456µs   p(90)=303µs    p(95)=315µs   
     http_req_duration..............: avg=186.02ms min=114ms    med=124.68ms max=680.8ms p(90)=405.58ms p(95)=495.19ms
       { expected_response:true }...: avg=186.02ms min=114ms    med=124.68ms max=680.8ms p(90)=405.58ms p(95)=495.19ms
     http_req_failed................: 0.00%   ✓ 0         ✗ 101 
     http_req_receiving.............: avg=249.84µs min=100µs    med=245µs    max=379µs   p(90)=317µs    p(95)=323µs   
     http_req_sending...............: avg=40.17µs  min=15µs     med=35µs     max=164µs   p(90)=74µs     p(95)=93µs    
     http_req_tls_handshaking.......: avg=0s       min=0s       med=0s       max=0s      p(90)=0s       p(95)=0s      
     http_req_waiting...............: avg=185.73ms min=113.66ms med=124.47ms max=680.4ms p(90)=405.29ms p(95)=494.92ms
     http_reqs......................: 101     19.705372/s
     iteration_duration.............: avg=186.31ms min=114.24ms med=124.87ms max=682.6ms p(90)=406.19ms p(95)=495.86ms
     iterations.....................: 101     19.705372/s
     vus............................: 20      min=20      max=20
     vus_max........................: 20      min=20      max=20

```

Rate limited result :
```java
k6 run redis_rate_limiting_demo.js 

          /\      |‾‾| /‾‾/   /‾‾/   
     /\  /  \     |  |/  /   /  /    
    /  \/    \    |     (   /   ‾‾\  
   /          \   |  |\  \ |  (‾)  | 
  / __________ \  |__| \__\ \_____/ .io

  execution: local
     script: redis_rate_limiting_demo.js
     output: -

  scenarios: (100.00%) 1 scenario, 20 max VUs, 35s max duration (incl. graceful stop):
           * constant_request_rate: 20.00 iterations/s for 5s (maxVUs: 20, gracefulStop: 30s)


running (05.1s), 00/20 VUs, 100 complete and 0 interrupted iterations
constant_request_rate ✓ [======================================] 00/20 VUs  5s  20.00 iters/s

     ✗ we expect all requests to pass
      ↳  57% — ✓ 57 / ✗ 43
     ✗ we expect some requests to return 429
      ↳  43% — ✓ 43 / ✗ 57

     429_failure_rate...............: 43.00% ✓ 43        ✗ 57  
     all_errors_failure_rate........: 43.00% ✓ 43        ✗ 57  
     checks.........................: 50.00% ✓ 100       ✗ 100 
     data_received..................: 574 kB 113 kB/s
     data_sent......................: 9.8 kB 1.9 kB/s
     http_req_blocked...............: avg=102.85µs min=3µs      med=7µs      max=1.06ms   p(90)=387.4µs  p(95)=584.15µs
     http_req_connecting............: avg=70.56µs  min=0s       med=0s       max=520µs    p(90)=309.4µs  p(95)=467.05µs
     http_req_duration..............: avg=78.59ms  min=2.59ms   med=119.33ms max=366.6ms  p(90)=127.18ms p(95)=131.21ms
       { expected_response:true }...: avg=135.17ms min=116.58ms med=124.43ms max=366.6ms  p(90)=129.53ms p(95)=195.34ms
     http_req_failed................: 43.00% ✓ 43        ✗ 57  
     http_req_receiving.............: avg=168.02µs min=30µs     med=188µs    max=750µs    p(90)=317.8µs  p(95)=341.65µs
     http_req_sending...............: avg=40.76µs  min=12µs     med=35µs     max=126µs    p(90)=76.3µs   p(95)=89.09µs 
     http_req_tls_handshaking.......: avg=0s       min=0s       med=0s       max=0s       p(90)=0s       p(95)=0s      
     http_req_waiting...............: avg=78.38ms  min=2.51ms   med=119.09ms max=366.34ms p(90)=126.82ms p(95)=130.82ms
     http_reqs......................: 100    19.718833/s
     iteration_duration.............: avg=78.91ms  min=2.84ms   med=119.5ms  max=366.81ms p(90)=127.61ms p(95)=131.49ms
     iterations.....................: 100    19.718833/s
     vus............................: 20     min=20      max=20
     vus_max........................: 20     min=20      max=20

```