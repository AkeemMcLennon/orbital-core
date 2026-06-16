import contacts from "./contacts";
import auth from "./auth";
import { router as integrations } from "./integrations";
import relationships from "./relationships";
import memoryReps from "./memory-reps";
import account from "./account";
import tags from "./tags";
import settings from "./settings";

export const router = {
  contacts,
  auth,
  integrations,
  relationships,
  memoryReps,
  account,
  tags,
  settings,
};

export default router;
