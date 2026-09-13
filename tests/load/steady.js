import http from "k6/http";
import { check, fail, sleep } from "k6";

const base = (__ENV.BASE_URL || "").replace(/\/$/, "");
if (!base) fail("BASE_URL is required");
if (base === "https://myplan.oxytumzone.com") fail("Production load testing is blocked");

export const options = {
  stages: [
    { duration: "1m", target: 5 },
    { duration: "3m", target: 10 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500", "p(99)<2500"],
  },
};

export default function () {
  const response = http.get(`${base}/login`, { redirects: 3 });
  check(response, { "login responds successfully": (r) => r.status === 200 });
  sleep(1);
}
