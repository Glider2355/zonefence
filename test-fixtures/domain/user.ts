// This import should be allowed (same folder)
import { validateEmail } from "./validation.js";

// This import should be DENIED (external package)
import axios from "axios";

// This import should be DENIED (infrastructure layer)
import { db } from "../infrastructure/database.js";

export interface User {
  id: string;
  email: string;
}

export function createUser(email: string): User {
  if (!validateEmail(email)) {
    throw new Error("Invalid email");
  }
  return { id: crypto.randomUUID(), email };
}
