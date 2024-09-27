import { Language, Submission, User } from "@repo/database";

export interface QueuePayload {
  language: Language;
  code: string;
  userId: User["id"];
  submissionId: Submission["id"];
}
