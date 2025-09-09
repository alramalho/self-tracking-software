"use server";

import { validateUser } from "@/lib/server-utils";
import { todaysLocalDate } from "@/lib/utils";
import { prisma } from "@tsw/prisma";

export async function getMetrics() {
  const user = await validateUser();

  try {
    return await prisma.metric.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    throw error;
  }
}

export async function getMetricEntries() {
  const user = await validateUser();

  try {
    return await prisma.metricEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Error fetching metrics entries:", error);
    throw error;
  }
}

export async function upsertMetric(data: { title: string; emoji: string }) {
  const user = await validateUser();

  try {
    // Check if metric with same name already exists
    const existingMetric = await prisma.metric.findFirst({
      where: {
        userId: user.id,
        title: {
          equals: data.title,
          mode: "insensitive",
        },
      },
    });

    if (existingMetric) {
      throw new Error(`A metric with this name '${data.title}' already exists`);
    }

    return await prisma.metric.create({
      data: {
        userId: user.id,
        title: data.title,
        emoji: data.emoji,
      },
    });
  } catch (error) {
    console.error("Error creating metric:", error);
    throw error;
  }
}

export async function upsertMetricEntry(data: {
  metricId: string;
  rating?: number;
  date?: Date;
  description?: string;
  skipped?: boolean;
  descriptionSkipped?: boolean;
}) {
  const user = await validateUser();

  try {
    const entryDate = data.date || todaysLocalDate();

    // Check if an entry already exists for this date
    const existingEntry = await prisma.metricEntry.findFirst({
      where: {
        metricId: data.metricId,
        date: {
          equals: entryDate,
        },
      },
    });

    if (existingEntry) {
      // Update existing entry
      const updateData: any = {};
      if (data.rating !== undefined) updateData.rating = data.rating;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.skipped !== undefined) updateData.skipped = data.skipped;
      if (data.descriptionSkipped !== undefined)
        updateData.descriptionSkipped = data.descriptionSkipped;

      return await prisma.metricEntry.update({
        where: { id: existingEntry.id },
        data: updateData,
      });
    } else {
      // Create new entry
      return await prisma.metricEntry.create({
        data: {
          userId: user.id,
          metricId: data.metricId,
          rating: data.rating || 0,
          date: entryDate,
          description: data.description,
          skipped: data.skipped || false,
          descriptionSkipped: data.descriptionSkipped || false,
        },
      });
    }
  } catch (error) {
    console.error("Error upserting metric entry:", error);
    throw error;
  }
}

export async function updateTodaysNote(data: {
  note?: string;
  skip?: boolean;
}) {
  const user = await validateUser();
  const today = todaysLocalDate();

  try {
    // Get all metric entries for today
    const todaysEntries = await prisma.metricEntry.findMany({
      where: {
        userId: user.id,
        date: today,
      },
    });

    if (todaysEntries.length === 0) {
      throw new Error("No metric entries found for today");
    }

    // Prepare update data based on parameters
    const updateData: any = {};
    if (data.note !== undefined) {
      updateData.description = data.note;
    }
    if (data.skip !== undefined) {
      updateData.descriptionSkipped = data.skip;
    }

    // Update all today's entries
    const updateResult = await prisma.metricEntry.updateMany({
      where: {
        userId: user.id,
        date: today,
      },
      data: updateData,
    });

    return updateResult;
  } catch (error) {
    console.error("Error updating today's note:", error);
    throw error;
  }
}

export async function deleteMetric(metricId: string) {
  const user = await validateUser();

  try {
    // Verify ownership
    const metric = await prisma.metric.findUnique({
      where: { id: metricId },
    });

    if (!metric) {
      throw new Error("Metric not found");
    }

    if (metric.userId !== user.id) {
      throw new Error("Not authorized to delete this metric");
    }

    // Delete metric (entries will be cascade deleted)
    return await prisma.metric.delete({
      where: { id: metricId },
    });
  } catch (error) {
    console.error("Error deleting metric:", error);
    throw error;
  }
}
