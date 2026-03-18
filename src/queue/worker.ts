import { Worker } from "bullmq";
import { prisma } from "../prisma/client";
import Docker from "dockerode";
import { JobPullContainer } from "./queue";

const docker = new Docker();

export const JobDispatcherWorker = new Worker(
  "job-dispatcher",
  async (job) => {
    await prisma.$transaction(async (tx: any) => {
      const jobRecord: any[] = await tx.$queryRaw`
        SELECT * FROM "JobContainers"
        WHERE status = 'PENDING'
        FOR UPDATE SKIP LOCKED
        LIMIT 1;
        `;

      if (!jobRecord.length) return;

      const record = jobRecord[0];

      console.log("Processing job container with ID:", record.id);

      await tx.jobContainers.update({
        where: { id: record.id },
        data: { status: "RUNNABLE" },
      });

      JobPullContainer.add("job-pull-container", {
        jobId: record.id,
      });

      console.log("Dispatched status to Pending to Runnable");
    });
  },
  {
    connection: {
      host: "localhost",
      port: 6379,
    },
  },
);

export const JobPullContainerWorker = new Worker(
  "job-pull-container",
  async (job) => {
    const { jobId } = job.data;

    const record = await prisma.jobContainers.findUnique({
      where: { id: jobId },
    });

    if (!record || record.status !== "RUNNABLE") return;

    console.log("Provisioning:", record.id);

    const image = `${record.image}:latest`;

    const exists = await docker
      .getImage(image)
      .inspect()
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      console.log("Pulling image:", image);

      await new Promise((resolve, reject) => {
        docker.pull(image, (err: any, stream: any) => {
          if (err) return reject(err);

          docker.modem.followProgress(stream, (err: any) => {
            if (err) reject(err);
            else resolve(true);
          });
        });
      });
    }

    const container = await docker.createContainer({
      Image: image,
      name: `job-${record.id}`,
      Tty: true,
      HostConfig: {
        Memory: 512 * 1024 * 1024,
      },
    });

    console.log("Created:", container.id);

    await container.start();

    console.log("Started:", container.id);

    await prisma.jobContainers.update({
      where: { id: record.id },
      data: {
        status: "RUNNING",
        containerId: container.id,
      },
    });
  },
  {
    connection: { host: "localhost", port: 6379 },
  },
);


docker.getEvents((err: any, stream: any) => {
  if (err) throw err;
  stream.on("data", async (data: any) => {
    const event = JSON.parse(data.toString());
    if (event.Type === "container" && event.Action === "die") {
      const containerId = event.Actor.ID;

      const record = await prisma.jobContainers.findFirst({
        where: { containerId },
      });

      if (!record) return;

      await prisma.jobContainers.update({
        where: { id: record.id },
        data: {
          status: "STOPPED",
        },
      });

      try {
        const container = docker.getContainer(containerId);
        await container.remove({ force: true });
        console.log(`Container ${containerId} removed successfully!`);
      } catch (error) {
        console.log(`Container ${containerId} already removed!`);
      }
    }
  });
});
