import express from "express";
import { prisma } from "./src/prisma/client";
import { JobDispatcher } from "./src/queue/queue";

const app = express();
app.use(express.json());

app.post("/api/create-containers", async (req, res) => {
  const { image } = req.body;

  const jobContainer = await prisma.jobContainers.create({
    data: {
      image,
    },
  });

  if (!jobContainer) {
    return res.status(500).json({ message: "Failed to create job container" });
  }

  await JobDispatcher.add("dispatch-job-status", {
    jobContainerId: jobContainer.id,
  });

  res
    .status(200)
    .json({ message: "Containers queued for creation", data: jobContainer });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
