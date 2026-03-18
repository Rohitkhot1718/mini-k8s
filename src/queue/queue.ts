import { Queue } from "bullmq";

export const JobDispatcher = new Queue("job-dispatcher", {
  connection: {
    host: "localhost",
    port: 6379,
  },
});

export const JobPullContainer = new Queue("job-pull-container", {
  connection: {
    host: "localhost",
    port: 6379,
  },
});
