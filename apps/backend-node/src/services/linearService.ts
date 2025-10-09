import { LinearClient } from "@linear/sdk";
import { logger } from "../utils/logger";

interface BugReportData {
  title: string;
  description: string;
  reporterEmail?: string;
  reporterUsername?: string;
  imageUrls?: string[];
}

export class LinearService {
  private client: LinearClient | null;
  private teamId: string | null = null;
  private assigneeId: string | null = null;
  private labelId: string | null = null;
  private triageStateId: string | null = null;

  constructor() {
    const apiKey = process.env.LINEAR_API_KEY;

    if (!apiKey) {
      logger.warn("Linear API key not configured");
      this.client = null;
      return;
    }

    this.client = new LinearClient({ apiKey });
    this.initializeLinearData();
  }

  private async initializeLinearData(): Promise<void> {
    if (!this.client) return;

    try {
      // Find team by identifier 'TRA'
      const teams = await this.client.teams();
      const team = teams.nodes.find((t) => t.key === "TRA");

      if (team) {
        this.teamId = team.id;

        // Find the user by email
        const users = await this.client.users();
        const assignee = users.nodes.find(
          (u) => u.email === "alexandre.ramalho.1998@gmail.com"
        );
        if (assignee) {
          this.assigneeId = assignee.id;
        }

        // Find "Bug" label
        const labels = await team.labels();
        const bugLabel = labels.nodes.find(
          (l) => l.name.toLowerCase() === "bug"
        );
        if (bugLabel) {
          this.labelId = bugLabel.id;
        }

        // Find "Triage" state
        const states = await team.states();
        const triageState = states.nodes.find(
          (s) => s.name.toLowerCase() === "triage"
        );
        if (triageState) {
          this.triageStateId = triageState.id;
        }
      }
    } catch (error) {
      logger.error("Failed to initialize Linear data:", error);
    }
  }

  async createBugTicket(data: BugReportData): Promise<string | null> {
    if (!this.client) {
      logger.warn("Linear client not initialized - skipping ticket creation");
      return null;
    }

    // Wait for initialization to complete
    if (!this.teamId) {
      await this.initializeLinearData();
    }

    if (!this.teamId) {
      logger.error("Linear team 'TRA' not found");
      return null;
    }

    try {
      // Build description with metadata
      let description = data.description;

      // Add timestamp
      description += `\n\n---\n**Reported At:** ${new Date().toISOString()}\n`;

      if (data.reporterUsername || data.reporterEmail) {
        description += "\n**Reporter Info:**\n";
        if (data.reporterUsername) {
          description += `- Username: ${data.reporterUsername}\n`;
        }
        if (data.reporterEmail) {
          description += `- Email: ${data.reporterEmail}\n`;
        }
      }

      if (data.imageUrls && data.imageUrls.length > 0) {
        description += "\n**Attached Images:**\n\n";
        data.imageUrls.forEach((url, index) => {
          // Include both the clickable link and the embedded image
          description += `**Image ${index + 1}:** [View full size](${url})\n\n![Screenshot ${index + 1}](${url})\n\n`;
        });
      }

      const issuePayload: any = {
        teamId: this.teamId,
        title: data.title,
        description,
      };

      // Add optional fields if they were found
      if (this.assigneeId) {
        issuePayload.assigneeId = this.assigneeId;
      }
      if (this.labelId) {
        issuePayload.labelIds = [this.labelId];
      }
      if (this.triageStateId) {
        issuePayload.stateId = this.triageStateId;
      }

      const issuePayloadResult = await this.client.createIssue(issuePayload);
      const issue = await issuePayloadResult.issue;

      if (issue) {
        logger.info(`Linear ticket created successfully: ${issue.identifier}`);
        return issue.url || issue.identifier;
      }

      return null;
    } catch (error) {
      logger.error("Failed to create Linear ticket:", error);
      return null;
    }
  }
}

export const linearService = new LinearService();
